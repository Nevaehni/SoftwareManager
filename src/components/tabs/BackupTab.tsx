import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FolderOpen } from 'lucide-react'
import { getDisplayFileName } from '@/lib/file-utils'

interface BackupTabProps {
    selectedPackageFile: string | null
    isRunning: boolean
    onSelectPackageFile: () => void
    onExecuteOperation: (mode: 'backup') => void
}

export const BackupTab = ({
    selectedPackageFile,
    isRunning,
    onSelectPackageFile,
    onExecuteOperation
}: BackupTabProps) => {
    const displayFile = getDisplayFileName(selectedPackageFile)

    return (
        <div className="flex-1 p-4 overflow-y-auto">
            <div className="h-full flex items-center justify-center">
                <Card className="w-full max-w-lg p-8">
                    <div className="space-y-4">
                        {!selectedPackageFile ? (
                            <div className="text-center space-y-4">
                                <div className="text-muted-foreground">No package file selected</div>
                                <Button onClick={onSelectPackageFile} variant="outline" size="lg">
                                    <FolderOpen className="h-4 w-4 mr-2" />
                                    Select Package File
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="text-center text-sm text-muted-foreground">
                                    Using package file: <span className="font-medium">{displayFile?.fileName}</span>
                                </div>
                                <Button
                                    onClick={() => onExecuteOperation('backup')}
                                    disabled={isRunning}
                                    className="w-full"
                                    size="lg"
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    {isRunning ? 'Creating Backup...' : 'Start Backup'}
                                </Button>
                            </>
                        )}

                        <p className="text-sm text-muted-foreground text-center">
                            This will create a configs.zip file with all backed up configurations
                        </p>                    </div>
                </Card>
            </div>
        </div>
    )
}
