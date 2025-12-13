import { promises as fs } from 'fs';

export type NetworkInterfaceStats = {
  interface: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
};

export type NetworkStats = {
  interfaces: NetworkInterfaceStats[];
  totalRxBytes: number;
  totalTxBytes: number;
};

const PROC_NET_DEV = '/proc/net/dev';

/**
 * Read network interface statistics from /proc/net/dev
 * Filters out loopback (lo) interface
 * Returns all active network interfaces
 */
export async function readNetworkStats(): Promise<NetworkStats | null> {
  try {
    const content = await fs.readFile(PROC_NET_DEV, 'utf-8');
    const lines = content.split('\n');

    const interfaces: NetworkInterfaceStats[] = [];
    let totalRx = 0;
    let totalTx = 0;

    // Skip header lines (first 2 lines)
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Format: "eth0: 12345 ..."
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      const iface = line.substring(0, colonIdx).trim();
      const statsStr = line.substring(colonIdx + 1).trim();
      const statsParts = statsStr.split(/\s+/);

      // Skip loopback
      if (iface === 'lo') continue;

      if (statsParts.length < 16) continue; // Ensure we have enough columns

      const rxBytes = parseInt(statsParts[0], 10);
      const rxPackets = parseInt(statsParts[1], 10);
      const rxErrors = parseInt(statsParts[2], 10);
      const txBytes = parseInt(statsParts[8], 10);
      const txPackets = parseInt(statsParts[9], 10);
      const txErrors = parseInt(statsParts[10], 10);

      // Skip if parsing failed
      if (isNaN(rxBytes) || isNaN(txBytes)) continue;

      interfaces.push({
        interface: iface,
        rxBytes,
        txBytes,
        rxPackets,
        txPackets,
        rxErrors,
        txErrors,
      });

      totalRx += rxBytes;
      totalTx += txBytes;
    }

    return {
      interfaces,
      totalRxBytes: totalRx,
      totalTxBytes: totalTx,
    };
  } catch (error) {
    console.error('Failed to read network stats:', error);
    return null;
  }
}
