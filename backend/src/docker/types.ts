export type DockerNetworkEndpoint = {
  Aliases?: string[];
  Links?: string[];
  DriverOpts?: Record<string, unknown>;
  IPAMConfig?: Record<string, unknown>;
};

export type DockerNetworkSettings = {
  Networks?: Record<string, DockerNetworkEndpoint>;
};

export type DockerConfig = {
  Image?: string;
  Hostname?: string;
  Domainname?: string;
  User?: string;
  AttachStdin?: boolean;
  AttachStdout?: boolean;
  AttachStderr?: boolean;
  Tty?: boolean;
  OpenStdin?: boolean;
  StdinOnce?: boolean;
  Env?: string[];
  Cmd?: string[];
  Healthcheck?: Record<string, unknown>;
  ArgsEscaped?: boolean;
  ExposedPorts?: Record<string, unknown>;
  Volumes?: Record<string, unknown>;
  WorkingDir?: string;
  Entrypoint?: string[] | string | null;
  NetworkDisabled?: boolean;
  MacAddress?: string;
  OnBuild?: unknown;
  Labels?: Record<string, string>;
  StopSignal?: string;
  StopTimeout?: number;
  Shell?: string[];
  [key: string]: unknown;
};

export type DockerHostConfig = {
  NetworkMode?: string;
  RestartPolicy?: Record<string, unknown>;
  Binds?: string[] | null;
  Mounts?: Record<string, unknown>;
  PortBindings?: Record<string, unknown>;
  LogConfig?: Record<string, unknown>;
  Privileged?: boolean;
  PublishAllPorts?: boolean;
  ReadonlyRootfs?: boolean;
  Dns?: string[];
  DnsOptions?: string[];
  DnsSearch?: string[];
  ExtraHosts?: string[];
  IpcMode?: string;
  PidMode?: string;
  UTSMode?: string;
  UsernsMode?: string;
  Runtime?: string;
  Devices?: unknown;
  DeviceRequests?: unknown;
  Sysctls?: Record<string, unknown>;
  ShmSize?: number;
  Tmpfs?: Record<string, unknown>;
  CapAdd?: string[];
  CapDrop?: string[];
  SecurityOpt?: string[];
  BlkioWeight?: number;
  Cgroup?: string;
  AutoRemove?: boolean;
  [key: string]: unknown;
};

export type DockerContainerInspect = {
  Id: string;
  Name?: string;
  Image?: string;
  Config?: DockerConfig;
  HostConfig?: DockerHostConfig;
  NetworkSettings?: DockerNetworkSettings;
  Mounts?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type DockerContainerCreateResponse = {
  Id: string;
  Warnings?: string[] | null;
};
