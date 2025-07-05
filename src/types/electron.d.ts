interface ElectronAPI {
  // PowerShell operations
  executePowerShell: (script: string, args?: string[]) => Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
  }>;

  // File operations
  selectFile: (options: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;

  selectFolder: (options?: {
    title?: string;
  }) => Promise<{
    canceled: boolean;
    filePaths: string[];
  }>;

  showSaveDialog: (options: {
    title?: string;
    filters?: { name: string; extensions: string[] }[];
  }) => Promise<{
    canceled: boolean;
    filePath?: string;
  }>;

  // App paths
  getAppPath: () => Promise<string>;
  getUserDataPath: () => Promise<string>;

  // File system
  fileExists: (filePath: string) => Promise<boolean>; readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;

  // Event listeners
  onPowerShellOutput: (callback: (data: string) => void) => void;
  onPowerShellError: (callback: (data: string) => void) => void;

  // Remove listeners
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export { };
