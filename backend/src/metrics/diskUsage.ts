import { promises as fs } from 'fs';

export type DiskUsage = {
  filesystem: string;
  mountpoint: string;
  fsType: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usedPercent: number;
};

const PROC_MOUNTS = '/proc/mounts';

// Read-only images and pseudo mounts that never represent usable storage
const EXCLUDED_FS_TYPES = new Set(['squashfs', 'iso9660', 'ramfs', 'erofs']);

/**
 * /proc/mounts escapes special characters in paths as octal
 * sequences (e.g. "\040" for space)
 */
function decodeMountPath(path: string): string {
  return path.replace(/\\([0-7]{3})/g, (_, oct: string) =>
    String.fromCharCode(parseInt(oct, 8))
  );
}

function isRealDevice(device: string): boolean {
  if (!device.startsWith('/dev/')) return false;
  if (device.startsWith('/dev/loop') || device.startsWith('/dev/ram')) return false;
  return true;
}

async function statDiskUsage(
  filesystem: string,
  mountpoint: string,
  fsType: string
): Promise<DiskUsage | null> {
  try {
    const s = await fs.statfs(mountpoint);
    const totalBytes = s.blocks * s.bsize;
    if (totalBytes <= 0) return null;
    const availableBytes = s.bavail * s.bsize;
    const usedBytes = totalBytes - s.bfree * s.bsize;
    const capacity = usedBytes + availableBytes;
    return {
      filesystem,
      mountpoint,
      fsType,
      totalBytes,
      usedBytes,
      availableBytes,
      usedPercent: capacity > 0 ? (usedBytes / capacity) * 100 : 0
    };
  } catch {
    return null;
  }
}

/**
 * Read disk usage for the root filesystem and any additional real
 * (device-backed) mounts visible to the process.
 *
 * Inside a Docker container statfs("/") reports the stats of the
 * filesystem backing the overlay upper dir — on a Raspberry Pi that is
 * the SD card root partition. Extra disks appear when their mountpoints
 * are bind-mounted into the container.
 */
export async function readDiskUsage(): Promise<DiskUsage[] | null> {
  let rootFilesystem = 'rootfs';
  let rootFsType = '';
  // device -> shortest mountpoint carrying it
  const deviceMounts = new Map<string, { mountpoint: string; fsType: string }>();

  try {
    const content = await fs.readFile(PROC_MOUNTS, 'utf8');
    for (const line of content.split('\n')) {
      const parts = line.split(' ');
      if (parts.length < 3) continue;
      const device = decodeMountPath(parts[0]);
      const mountpoint = decodeMountPath(parts[1]);
      const fsType = parts[2];

      if (mountpoint === '/') {
        rootFilesystem = device;
        rootFsType = fsType;
        continue;
      }

      if (!isRealDevice(device) || EXCLUDED_FS_TYPES.has(fsType)) continue;
      // Skip container plumbing (e.g. Docker binds /etc/hostname, /etc/hosts)
      if (
        mountpoint.startsWith('/etc/') ||
        mountpoint.startsWith('/dev/') ||
        mountpoint.startsWith('/proc/') ||
        mountpoint.startsWith('/sys/') ||
        mountpoint.startsWith('/boot')
      ) {
        continue;
      }

      const existing = deviceMounts.get(device);
      if (!existing || mountpoint.length < existing.mountpoint.length) {
        deviceMounts.set(device, { mountpoint, fsType });
      }
    }
  } catch {
    // /proc/mounts unavailable — still try to report the root filesystem
  }

  const results = await Promise.all([
    statDiskUsage(rootFilesystem, '/', rootFsType),
    ...Array.from(deviceMounts.entries()).map(([device, m]) =>
      statDiskUsage(device, m.mountpoint, m.fsType)
    )
  ]);

  const root = results[0];
  const extra = results
    .slice(1)
    .filter((d): d is DiskUsage => d !== null)
    // Drop bind mounts that are just another view of the root filesystem
    .filter(
      d =>
        !root ||
        d.totalBytes !== root.totalBytes ||
        Math.abs(d.usedBytes - root.usedBytes) > 16 * 1024 * 1024
    )
    .sort((a, b) => a.mountpoint.localeCompare(b.mountpoint));

  const disks = root ? [root, ...extra] : extra;
  return disks.length > 0 ? disks : null;
}
