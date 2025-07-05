import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FolderOpen } from 'lucide-react'
import { getDisplayFileName } from '@/lib/file-utils'

interface RestoreTabProps {
    selectedPackageFile: string | null
    selectedConfigFile: string | null
    isRunning: boolean
    onSelectPackageFile: () => void
    onSelectConfigFile: () => void
    onExecuteOperation: (mode: 'install') => void
}

export const RestoreTab = ({
    selectedPackageFile,
    selectedConfigFile,
    isRunning,
    onSelectPackageFile,
    onSelectConfigFile,
    onExecuteOperation
}: RestoreTabProps) => {
    const displayPackageFile = getDisplayFileName(selectedPackageFile)
    const displayConfigFile = getDisplayFileName(selectedConfigFile)

    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                <Card className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">Package List File</label>
                            <div className="flex gap-3">
                                <div className="flex-1 p-3 bg-muted rounded-lg">
                                    {selectedPackageFile ? (
                                        <div>
                                            <div className="font-medium">{displayPackageFile?.fileName}</div>
                                            <div className="text-sm text-muted-foreground">{displayPackageFile?.directory}</div>
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground">No package file selected</div>
                                    )}
                                </div>
                                <Button onClick={onSelectPackageFile} variant="outline">
                                    <FolderOpen className="h-4 w-4 mr-2" />
                                    Select File
                                </Button>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">Configuration Archive</label>
                            <div className="flex gap-3">
                                <div className="flex-1 p-3 bg-muted rounded-lg">
                                    {selectedConfigFile ? (
                                        <div>
                                            <div className="font-medium">{displayConfigFile?.fileName}</div>
                                            <div className="text-sm text-muted-foreground">{displayConfigFile?.directory}</div>
                                        </div>
                                    ) : (
                                        <div className="text-muted-foreground">No config archive selected</div>
                                    )}
                                </div>
                                <Button onClick={onSelectConfigFile} variant="outline">
                                    <FolderOpen className="h-4 w-4 mr-2" />
                                    Select Archive
                                </Button>
                            </div>
                        </div>

                        <Button
                            onClick={() => onExecuteOperation('install')}
                            disabled={isRunning || !selectedPackageFile}
                            className="w-full"
                            size="lg"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            {isRunning ? 'Installing & Restoring...' : 'Start Install & Restore'}
                        </Button>

                        <p className="text-sm text-muted-foreground text-center">
                            This will install packages via Chocolatey and restore configurations
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    )
}
