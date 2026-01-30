/**
 * Router data types for TP-Link LTE router monitoring
 */

export enum NetworkType {
  NoService = 0,
  GSM = 1,
  WCDMA = 2,
  LTE = 3,
  TDSCDMA = 4,
  CDMA1x = 5,
  CDMAEvDo = 6,
  LTEPlus = 7
}

export enum SimStatusCode {
  NoSimOrError = 0,
  NoSim = 1,
  SimError = 2,
  SimReady = 3,
  SimLocked = 4,
  SimUnlocked = 5,
  PinLocked = 6,
  PermLocked = 7,
  Suspended = 8,
  Unopened = 9
}

export type SignalQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

export interface LteSignal {
  networkType: NetworkType;
  networkTypeName: string;
  rsrp: number | null;
  rsrq: number | null;
  snr: number | null;
  signalStrength: number;
  signalQuality: SignalQuality;
}

export interface SimStatus {
  status: SimStatusCode;
  statusText: string;
  isOk: boolean;
}

export interface WanTraffic {
  downloadBytesPerSec: number;
  uploadBytesPerSec: number;
  totalDownloadBytes: number;
  totalUploadBytes: number;
}

export type ConnectionType = 'wired' | 'wifi_2g' | 'wifi_5g' | 'wifi_6g';

export interface ConnectedDevice {
  macAddress: string;
  ipAddress: string;
  hostname: string;
  displayName: string;
  connectionType: ConnectionType;
  signalStrength: number | null;
  downloadBytesPerSec: number;
  uploadBytesPerSec: number;
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

export interface RouterConfig {
  enabled: boolean;
  host: string;
  username: string;
  password: string;
  useHttps: boolean;
  pollIntervalMs: number;
  historySize: number;
}
