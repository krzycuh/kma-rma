/**
 * Format bytes to human-readable string with auto unit selection
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const index = Math.min(i, sizes.length - 1);

  return `${(bytes / Math.pow(k, index)).toFixed(decimals)} ${sizes[index]}`;
}

/**
 * Format bytes per second to human-readable string
 */
export function formatBytesPerSec(bytesPerSec: number | null | undefined): string {
  if (bytesPerSec == null) return '—';
  return `${formatBytes(bytesPerSec)}/s`;
}

/**
 * Format uptime seconds to human-readable string
 */
export function formatUptime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(' ') || '0m';
}
