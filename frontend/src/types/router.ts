/**
 * Router data types for frontend
 * Mirrors backend/src/router/types.ts
 */

export type SignalQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export interface LteSignal {
  networkType: number;
  networkTypeName: string;
  rsrp: number | null;
  rsrq: number | null;
  snr: number | null;
  signalStrength: number;
  signalQuality: SignalQuality;
}

export interface SimStatus {
  status: number;
  statusText: string;
  isOk: boolean;
}

export interface WanTraffic {
  downloadBytesPerSec: number;
  uploadBytesPerSec: number;
  totalBytes: number;  // Cumulative total (router doesn't split by direction)
}

export type ConnectionType = 'wired' | 'wifi_2g' | 'wifi_5g' | 'wifi_6g';

export interface ConnectedDevice {
  macAddress: string;
  ipAddress: string;
  hostname: string;
  displayName: string;
  connectionType: ConnectionType;
  signalStrength: number | null;
  packetsSent: number | null;
  packetsReceived: number | null;
  isActive: boolean;
}

export interface DeviceCounts {
  total: number;
  wired: number;
  wifi: number;
  active: number;
}

export interface ConnectionInfo {
  wanIp: string;
  uptimeSeconds: number;
  ispName: string;
}

export interface RouterSystemInfo {
  cpuUsage: number;
  memoryUsage: number;
  firmwareVersion: string;
  model: string;
}

export interface RouterStatus {
  timestamp: number;
  lte: LteSignal;
  sim: SimStatus;
  wan: WanTraffic;
  devices: ConnectedDevice[];
  deviceCounts: DeviceCounts;
  connection: ConnectionInfo;
  system: RouterSystemInfo;
}

export type RouterErrorCode =
  | 'AUTH_FAILED'
  | 'TIMEOUT'
  | 'CONNECTION_ERROR'
  | 'PARSE_ERROR'
  | 'MISSING_DEPENDENCY'
  | 'UNKNOWN';

export interface RouterResultSuccess {
  success: true;
  data: RouterStatus;
  timestamp: number;
}

export interface RouterResultError {
  success: false;
  error: string;
  errorCode: RouterErrorCode;
  timestamp: number;
}

export type RouterResult = RouterResultSuccess | RouterResultError;
