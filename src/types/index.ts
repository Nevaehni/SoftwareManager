export interface OperationLog {
    timestamp: string
    message: string
    type: 'info' | 'error' | 'success' | 'warning'
}

export interface ChocolateyPackage {
    name: string
    title: string
    summary: string
    version: string
}

export interface InstalledProgram {
    name: string
    version: string
    publisher: string
    isChocolateyPackage: boolean
    chocolateyName?: string
}

export interface PackageStats {
    success: boolean
    chocolatey: {
        available: boolean
        version: string
        installedPackages: number
    }
    packagesFile: {
        exists: boolean
        totalPackages: number
        configPackages: number
    }
    installedPrograms: {
        registry: number
        store: number
    }
    system: {
        isAdmin: boolean
        psVersion: string
        os: string
    }
}

export interface FileDisplayInfo {
    fileName: string
    directory: string
    fullPath: string
}

export type TabType = 'backup' | 'restore' | 'editor' | 'packages' | 'dashboard'
