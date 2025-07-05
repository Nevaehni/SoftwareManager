import { Card } from '@/components/ui/card'
import { FileText, Edit3 } from 'lucide-react'
import { FileEditor } from '@/components/FileEditor'
import { getDisplayFileName } from '@/lib/file-utils'

interface EditorTabProps {
    editingFile: string | null
    selectedPackageFile: string | null
    onLog: (message: string, type: 'info' | 'error' | 'success' | 'warning') => void
    onCloseEditor: () => void
    onEditPackageFile: () => void
    onEditConfigMappings: () => void
}

export const EditorTab = ({
    editingFile,
    selectedPackageFile,
    onLog,
    onCloseEditor,
    onEditPackageFile,
    onEditConfigMappings
}: EditorTabProps) => {
    const displayFile = getDisplayFileName(selectedPackageFile)

    if (editingFile) {
        return (
            <div className="flex-1 min-h-0">
                <FileEditor
                    filePath={editingFile}
                    onLog={onLog}
                    onClose={onCloseEditor}
                />
            </div>
        )
    }    return (
        <div className="flex-1 p-4 overflow-y-auto">
            <div className="h-full flex items-center justify-center">
                <div className="w-full max-w-2xl space-y-4">
                    <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-200" onClick={onEditPackageFile}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <FileText className="h-6 w-6 text-blue-600" />
                                </div>
                                <div>
                                    <div className="font-semibold">Package List</div>
                                    <div className="text-sm text-muted-foreground">
                                        {selectedPackageFile ? displayFile?.fileName : 'No package file selected'}
                                    </div>
                                </div>
                            </div>
                            <Edit3 className="h-5 w-5 text-muted-foreground" />
                        </div>
                    </Card>

                    <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-purple-200" onClick={onEditConfigMappings}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                                    <Edit3 className="h-6 w-6 text-purple-600" />
                                </div>
                                <div>
                                    <div className="font-semibold">Configuration Mappings</div>
                                    <div className="text-sm text-muted-foreground">ConfigMappings.ps1</div>                                </div>
                            </div>
                            <Edit3 className="h-5 w-5 text-muted-foreground" />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}
