#!/usr/bin/env node
/**
 * Standalone script for detached container restart
 * This script runs independently of the main backend process,
 * allowing it to restart the container that hosts the backend itself.
 *
 * Usage: node restart-container.js <config-file-path>
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const DOCKER_SOCK_PATH = process.env.DOCKER_SOCK_PATH || '/var/run/docker.sock';
const LOG_DIR = process.env.RESTART_LOG_DIR || '/tmp/container-restart-logs';

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

class RestartLogger {
  constructor(containerName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logPath = path.join(LOG_DIR, `${containerName}-${timestamp}.log`);
    this.logs = [];
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}`;
    this.logs.push(logLine);
    console.log(logLine);

    // Append to file
    try {
      fs.appendFileSync(this.logPath, logLine + '\n');
    } catch (err) {
      console.error('Failed to write to log file:', err.message);
    }
  }

  getLogs() {
    return this.logs;
  }

  getLogPath() {
    return this.logPath;
  }
}

function dockerRequest(options) {
  return new Promise((resolve, reject) => {
    const { path, method = 'GET', headers = {}, body, timeoutMs = 30000 } = options;

    const req = http.request(
      {
        socketPath: DOCKER_SOCK_PATH,
        path,
        method,
        headers,
        timeout: timeoutMs
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          const statusCode = res.statusCode || 500;

          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Docker API ${method} ${path} failed with status ${statusCode}: ${responseBody}`));
            return;
          }

          resolve({
            statusCode,
            headers: res.headers,
            body: responseBody
          });
        });
      }
    );

    req.on('error', (err) => reject(new Error(`Docker API request error: ${err.message}`)));

    if (body) {
      const payload = typeof body === 'string' ? body : JSON.stringify(body);
      if (typeof body === 'object') {
        req.setHeader('Content-Type', 'application/json');
      }
      req.write(payload);
    }

    req.end();
  });
}

async function dockerJsonRequest(options) {
  const response = await dockerRequest({
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });

  try {
    return JSON.parse(response.body);
  } catch (err) {
    throw new Error(`Failed to parse JSON response: ${err.message}`);
  }
}

async function pullImage(image, logger) {
  logger.log(`Starting image pull: ${image}`);

  const parts = parseImageReference(image);
  const params = new URLSearchParams();

  if (parts.digest) {
    params.set('fromImage', `${parts.reference}@${parts.digest}`);
  } else {
    params.set('fromImage', parts.reference);
    if (parts.tag) params.set('tag', parts.tag);
  }

  const response = await dockerRequest({
    path: `/images/create?${params.toString()}`,
    method: 'POST'
  });

  const lines = response.body.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.error) {
        logger.log(`Pull error: ${parsed.error}`);
      } else if (parsed.status) {
        const msg = parsed.progress ? `${parsed.status} ${parsed.progress}` : parsed.status;
        logger.log(msg);
      }
    } catch {
      logger.log(line);
    }
  }

  logger.log('Image pull completed');
}

function parseImageReference(image) {
  const digestIndex = image.indexOf('@');
  if (digestIndex >= 0) {
    return {
      reference: image.slice(0, digestIndex),
      digest: image.slice(digestIndex + 1),
      original: image
    };
  }

  const lastSlash = image.lastIndexOf('/');
  const lastColon = image.lastIndexOf(':');
  if (lastColon > lastSlash) {
    return {
      reference: image.slice(0, lastColon),
      tag: image.slice(lastColon + 1),
      original: image
    };
  }

  return {
    reference: image,
    tag: 'latest',
    original: image
  };
}

async function stopContainer(id, logger) {
  logger.log(`Stopping container: ${id}`);
  try {
    await dockerRequest({
      path: `/containers/${encodeURIComponent(id)}/stop?t=10`,
      method: 'POST'
    });
    logger.log('Container stopped successfully');
  } catch (err) {
    if (err.message.includes('304')) {
      logger.log('Container already stopped');
    } else {
      throw err;
    }
  }
}

async function renameContainer(id, newName, logger) {
  logger.log(`Renaming container ${id} to ${newName}`);
  await dockerRequest({
    path: `/containers/${encodeURIComponent(id)}/rename?name=${encodeURIComponent(newName)}`,
    method: 'POST'
  });
  logger.log('Container renamed successfully');
}

async function createContainer(inspect, name, logger) {
  logger.log(`Creating new container: ${name}`);

  const config = sanitizeConfig(inspect.Config);
  config.Image = inspect.Config?.Image || inspect.Image || config.Image;

  const hostConfig = sanitizeHostConfig(inspect.HostConfig);
  const networkingConfig = buildNetworkingConfig(inspect.NetworkSettings);

  const body = { ...config };
  if (hostConfig) body.HostConfig = hostConfig;
  if (networkingConfig) body.NetworkingConfig = networkingConfig;

  const response = await dockerJsonRequest({
    path: `/containers/create?name=${encodeURIComponent(name)}`,
    method: 'POST',
    body
  });

  if (response.Warnings && response.Warnings.length > 0) {
    response.Warnings.forEach(w => logger.log(`Warning: ${w}`));
  }

  logger.log(`Container created with ID: ${response.Id}`);
  return response.Id;
}

function sanitizeConfig(config) {
  if (!config) return {};
  const result = {};
  for (const [key, value] of Object.entries(config)) {
    if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

function sanitizeHostConfig(hostConfig) {
  if (!hostConfig) return undefined;
  const result = {};
  for (const [key, value] of Object.entries(hostConfig)) {
    if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

function buildNetworkingConfig(settings) {
  if (!settings?.Networks) return undefined;
  const endpoints = {};

  for (const [name, endpoint] of Object.entries(settings.Networks)) {
    if (!endpoint) continue;
    const entry = {};

    if (endpoint.Aliases && endpoint.Aliases.length > 0) {
      entry.Aliases = endpoint.Aliases;
    }
    if (endpoint.DriverOpts && Object.keys(endpoint.DriverOpts).length > 0) {
      entry.DriverOpts = endpoint.DriverOpts;
    }
    if (endpoint.IPAMConfig && Object.keys(endpoint.IPAMConfig).length > 0) {
      entry.IPAMConfig = endpoint.IPAMConfig;
    }
    if (endpoint.Links && endpoint.Links.length > 0) {
      entry.Links = endpoint.Links;
    }

    endpoints[name] = entry;
  }

  if (Object.keys(endpoints).length === 0) return undefined;
  return { EndpointsConfig: endpoints };
}

async function startContainer(id, logger) {
  logger.log(`Starting container: ${id}`);
  await dockerRequest({
    path: `/containers/${encodeURIComponent(id)}/start`,
    method: 'POST'
  });
  logger.log('Container started successfully');
}

async function removeContainer(id, logger) {
  logger.log(`Removing old container: ${id}`);
  try {
    await dockerRequest({
      path: `/containers/${encodeURIComponent(id)}?force=true`,
      method: 'DELETE'
    });
    logger.log('Old container removed successfully');
  } catch (err) {
    logger.log(`Warning: Failed to remove old container: ${err.message}`);
  }
}

async function executeRestart(configPath) {
  let config;
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
  } catch (err) {
    console.error(`Failed to read config file ${configPath}: ${err.message}`);
    process.exit(1);
  }

  const { containerName, imageRef, inspect, waitSeconds = 2 } = config;
  const logger = new RestartLogger(containerName);

  logger.log('=== Detached Container Restart Started ===');
  logger.log(`Container: ${containerName}`);
  logger.log(`Image: ${imageRef}`);
  logger.log(`Config file: ${configPath}`);

  try {
    // Wait for parent process to send response
    logger.log(`Waiting ${waitSeconds} seconds for parent process to respond...`);
    await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000));

    // Pull latest image
    await pullImage(imageRef, logger);

    // Stop current container
    await stopContainer(inspect.Id, logger);

    // Rename old container
    const temporaryName = `${containerName}-old-${Date.now()}`;
    await renameContainer(inspect.Id, temporaryName, logger);

    // Create new container
    const newContainerId = await createContainer(inspect, containerName, logger);

    // Start new container
    await startContainer(newContainerId, logger);

    // Wait a bit to ensure new container is running
    logger.log('Waiting 5 seconds to verify new container...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Remove old container
    await removeContainer(inspect.Id, logger);

    // Cleanup config file
    try {
      fs.unlinkSync(configPath);
      logger.log('Config file cleaned up');
    } catch (err) {
      logger.log(`Warning: Failed to remove config file: ${err.message}`);
    }

    logger.log('=== Container Restart Completed Successfully ===');
    logger.log(`Log file: ${logger.getLogPath()}`);
    process.exit(0);

  } catch (err) {
    logger.log(`ERROR: ${err.message}`);
    logger.log('=== Container Restart Failed ===');
    logger.log(`Log file: ${logger.getLogPath()}`);

    // Attempt rollback
    logger.log('Attempting rollback...');
    try {
      const temporaryName = `${containerName}-old-${Date.now()}`;
      await renameContainer(inspect.Id, containerName, logger);
      await startContainer(inspect.Id, logger);
      logger.log('Rollback successful - old container restored');
    } catch (rollbackErr) {
      logger.log(`Rollback failed: ${rollbackErr.message}`);
      logger.log('CRITICAL: Container may be in inconsistent state!');
    }

    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const configPath = process.argv[2];

  if (!configPath) {
    console.error('Usage: node restart-container.js <config-file-path>');
    process.exit(1);
  }

  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  executeRestart(configPath).catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
}
