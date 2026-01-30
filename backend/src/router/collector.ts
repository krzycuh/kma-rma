/**
 * Router data collector using Python subprocess
 */

import { spawn } from 'child_process';
import path from 'path';
import { RouterResult, RouterConfig } from './types';

export class RouterCollector {
  private pythonScript: string;
  private config: RouterConfig;

  constructor(config: RouterConfig) {
    this.config = config;
    // Script is in backend/scripts/, this file is in backend/src/router/
    this.pythonScript = path.join(__dirname, '../../scripts/router_client.py');
  }

  /**
   * Collect router status by spawning Python subprocess
   */
  async collect(): Promise<RouterResult> {
    return new Promise((resolve) => {
      const args = [
        this.pythonScript,
        '--host', this.config.host,
        '--username', this.config.username,
        '--password', this.config.password,
      ];

      if (this.config.useHttps) {
        args.push('--https');
      }

      const proc = spawn('python3', args, {
        timeout: 30000, // 30 second timeout
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          error: `Failed to spawn Python process: ${err.message}`,
          errorCode: 'CONNECTION_ERROR',
          timestamp: Date.now()
        });
      });

      proc.on('close', (code) => {
        // Try to parse stdout as JSON regardless of exit code
        // because our Python script outputs JSON even on errors
        try {
          const result = JSON.parse(stdout) as RouterResult;
          resolve(result);
        } catch {
          // If we can't parse JSON, create an error result
          const errorMessage = stderr || stdout || `Python script exited with code ${code}`;
          resolve({
            success: false,
            error: errorMessage.trim(),
            errorCode: 'PARSE_ERROR',
            timestamp: Date.now()
          });
        }
      });

      // Handle timeout
      setTimeout(() => {
        try {
          proc.kill('SIGTERM');
        } catch {
          // Ignore kill errors
        }
      }, 25000);
    });
  }
}
