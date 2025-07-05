import { Button } from '@/components/ui/button'
import { Upload, Download, Edit3, Package, FolderOpen } from 'lucide-react'
import { TabType } from '@/types'
import { getDisplayFileName } from '@/lib/file-utils'

interface SidebarProps {
    selectedTab: TabType
    selectedPackageFile: string | null
    onTabChange: (tab: TabType) => void
    onEditPackageFile: () => void
    onSelectPackageFile: () => void
    onEditConfigMappings: () => void
}

export const Sidebar = ({
    selectedTab,
    selectedPackageFile,
    onTabChange,
    onEditPackageFile,
    onSelectPackageFile,
    onEditConfigMappings
}: SidebarProps) => {
    const displayFile = getDisplayFileName(selectedPackageFile)

    return (
        <div className="w-64 border-r bg-muted/30 flex flex-col flex-shrink-0">
            <nav className="p-4 space-y-2">
                <Button
                    onClick={() => onTabChange('backup')}
                    variant={selectedTab === 'backup' ? 'default' : 'ghost'}
                    className="w-full justify-start"
                >
                    <Upload className="h-4 w-4 mr-2" />
                    Backup
                </Button>
                <Button
                    onClick={() => onTabChange('restore')}
                    variant={selectedTab === 'restore' ? 'default' : 'ghost'}
                    className="w-full justify-start"
                >
                    <Download className="h-4 w-4 mr-2" />
                    Install & Restore
                </Button>
                <Button
                    onClick={() => onTabChange('editor')}
                    variant={selectedTab === 'editor' ? 'default' : 'ghost'}
                    className="w-full justify-start"
                >
                    <Edit3 className="h-4 w-4 mr-2" />
                    Editor
                </Button>
                <Button
                    onClick={() => onTabChange('packages')}
                    variant={selectedTab === 'packages' ? 'default' : 'ghost'}
                    className="w-full justify-start"
                >
                    <Package className="h-4 w-4 mr-2" />
                    Manage Packages
                </Button>
            </nav>

            {/* Files Section in Sidebar */}
            <div className="p-4 border-t overflow-y-auto">
                <div className="text-xs font-medium text-muted-foreground mb-3">Quick Edit</div>

                {/* Package List */}
                {selectedPackageFile && (
                    <div className="mb-3">
                        <div className="text-xs text-muted-foreground mb-1">Package List</div>
                        <div className="p-2 bg-background rounded text-xs">
                            <div className="font-medium">{displayFile?.fileName}</div>
                            <div className="text-muted-foreground truncate text-[10px]">{displayFile?.directory}</div>
                        </div>
                        <div className="flex gap-1 mt-1">
                            <Button onClick={onEditPackageFile} size="sm" variant="outline" className="flex-1 h-7 text-xs">
                                <Edit3 className="h-3 w-3 mr-1" />
                                Edit
                            </Button>
                            <Button onClick={onSelectPackageFile} size="sm" variant="outline" className="flex-1 h-7 text-xs">
                                <FolderOpen className="h-3 w-3 mr-1" />
                                Browse
                            </Button>
                        </div>
                    </div>
                )}

                {/* Config Mappings */}
                <div>
                    <div className="text-xs text-muted-foreground mb-1">Configuration</div>
                    <div className="p-2 bg-background rounded text-xs">
                        <div className="font-medium">ConfigMappings.ps1</div>
                        <div className="text-muted-foreground text-[10px]">PowerShell script</div>
                    </div>
                    <div className="flex gap-1 mt-1">
                        <Button onClick={onEditConfigMappings} size="sm" variant="outline" className="flex-1 h-7 text-xs">
                            <Edit3 className="h-3 w-3 mr-1" />
                            Edit
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
