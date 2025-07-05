import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, Download, Edit3, FileText, FolderOpen } from 'lucide-react'
import { getDisplayFileName } from '@/lib/file-utils'
import { TabType } from '@/types'

interface DashboardTabProps {
    selectedPackageFile: string | null
    onTabChange: (tab: TabType) => void
    onEditPackageFile: () => void
    onSelectPackageFile: () => void
    onEditConfigMappings: () => void
}

export const DashboardTab = ({
    selectedPackageFile,
    onTabChange,
    onEditPackageFile,
    onSelectPackageFile,
    onEditConfigMappings
}: DashboardTabProps) => {
    const displayFile = getDisplayFileName(selectedPackageFile)

    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="p-8 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-200" onClick={() => onTabChange('backup')}>
                        <div className="text-center space-y-4">
                            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                                <Upload className="h-8 w-8 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">Backup</h3>
                                <p className="text-muted-foreground mt-2">
                                    Create a backup of your configurations
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-8 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-green-200" onClick={() => onTabChange('restore')}>
                        <div className="text-center space-y-4">
                            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                <Download className="h-8 w-8 text-green-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">Install & Restore</h3>
                                <p className="text-muted-foreground mt-2">
                                    Set up a new PC with your applications
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-8 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-purple-200" onClick={onEditConfigMappings}>
                        <div className="text-center space-y-4">
                            <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                                <Edit3 className="h-8 w-8 text-purple-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold">Edit Configuration</h3>
                                <p className="text-muted-foreground mt-2">
                                    Modify application config mappings
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>

                {selectedPackageFile && (
                    <Card className="p-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <FileText className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <div className="font-semibold">{displayFile?.fileName}</div>
                                    <div className="text-sm text-muted-foreground">Currently selected package list</div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button onClick={onEditPackageFile} variant="outline">
                                    <Edit3 className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                                <Button onClick={onSelectPackageFile} variant="outline">
                                    <FolderOpen className="h-4 w-4 mr-2" />
                                    Change
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    )
}
