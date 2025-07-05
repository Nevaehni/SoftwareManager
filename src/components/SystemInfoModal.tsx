import React from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

interface PackageStats {
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

interface SystemInfoModalProps {
    open: boolean
    onClose: () => void
    packageStats: PackageStats | null
    isLoadingStats: boolean
    onLoadStats: () => void
}

export const SystemInfoModal: React.FC<SystemInfoModalProps> = ({
    open,
    onClose,
    packageStats,
    isLoadingStats,
    onLoadStats
}) => {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="System Information"
            className="max-w-lg"
        >
            <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Package management status and statistics
                </p>

                <Button
                    onClick={onLoadStats}
                    disabled={isLoadingStats}
                    className="w-full"
                    variant="outline"
                >
                    {isLoadingStats ? (
                        <>
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                            Loading Statistics...
                        </>
                    ) : (
                        'Load System Statistics'
                    )}
                </Button>

                {packageStats && (
                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <div className="font-medium text-gray-900">Chocolatey</div>
                                <div className="text-gray-600">
                                    Status: {packageStats.chocolatey.available ? 'Available' : 'Not Available'}
                                </div>
                                {packageStats.chocolatey.available && (
                                    <>
                                        <div className="text-gray-600">Version: {packageStats.chocolatey.version}</div>
                                        <div className="text-gray-600">Packages: {packageStats.chocolatey.installedPackages}</div>
                                    </>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="font-medium text-gray-900">System</div>
                                <div className="text-gray-600">
                                    Admin: {packageStats.system.isAdmin ? 'Yes' : 'No'}
                                </div>
                                <div className="text-gray-600">
                                    PowerShell: {packageStats.system.psVersion}
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-t">
                            <div className="font-medium text-gray-900 mb-2">Package File</div>
                            <div className="text-gray-600">
                                Status: {packageStats.packagesFile.exists ? 'Found' : 'Not Found'}
                            </div>
                            {packageStats.packagesFile.exists && (
                                <>
                                    <div className="text-gray-600">Total: {packageStats.packagesFile.totalPackages}</div>
                                    <div className="text-gray-600">With Config: {packageStats.packagesFile.configPackages}</div>
                                </>
                            )}
                        </div>

                        <div className="pt-2 border-t">
                            <div className="font-medium text-gray-900 mb-2">Installed Programs</div>
                            <div className="text-gray-600">Registry: {packageStats.installedPrograms.registry}</div>
                            <div className="text-gray-600">Store Apps: {packageStats.installedPrograms.store}</div>
                        </div>

                        {packageStats.system.os && (
                            <div className="pt-2 border-t">
                                <div className="font-medium text-gray-900 mb-2">Operating System</div>
                                <div className="text-gray-600">{packageStats.system.os}</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    )
}
