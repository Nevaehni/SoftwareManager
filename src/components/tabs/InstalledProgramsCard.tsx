import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Monitor, Plus, Search } from 'lucide-react'
import { InstalledProgram } from '@/types'

interface InstalledProgramsCardProps {
    installedPrograms: InstalledProgram[]
    isLoadingPrograms: boolean
    selectedPackageFile: string | null
    includeConfig: boolean
    onLoadPrograms: () => void
    onAddToList: (chocolateyName: string, programName: string) => void
    onSearchForProgram: (program: InstalledProgram) => void
}

export const InstalledProgramsCard = ({
    installedPrograms,
    isLoadingPrograms,
    selectedPackageFile,
    includeConfig,
    onLoadPrograms,
    onAddToList,
    onSearchForProgram
}: InstalledProgramsCardProps) => {
    return (
        <Card className="p-6">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Installed Programs
                </CardTitle>
                <CardDescription>
                    View all programs currently installed on this PC
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Button
                    onClick={onLoadPrograms}
                    disabled={isLoadingPrograms}
                    className="w-full"
                >
                    {isLoadingPrograms ? (
                        <>
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Loading Programs...
                        </>
                    ) : (
                        <>
                            <Monitor className="h-4 w-4 mr-2" />
                            Load Installed Programs
                        </>
                    )}
                </Button>

                <div className="max-h-96 overflow-y-auto space-y-2">
                    {installedPrograms.map((program, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-2">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-medium">{program.name}</h4>
                                        {program.isChocolateyPackage && (
                                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                                Chocolatey
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">v{program.version}</p>
                                    <p className="text-xs text-muted-foreground">{program.publisher}</p>
                                    {program.isChocolateyPackage && program.chocolateyName && (
                                        <p className="text-xs text-blue-600">Package: {program.chocolateyName}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {program.isChocolateyPackage && program.chocolateyName ? (
                                    <Button
                                        size="sm"
                                        onClick={() => onAddToList(program.chocolateyName!, program.name)}
                                        disabled={!selectedPackageFile}
                                        className="flex-1"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add to List{includeConfig ? ' + Config' : ''}
                                    </Button>
                                ) : (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onSearchForProgram(program)}
                                        className="flex-1"
                                    >
                                        <Search className="h-3 w-3 mr-1" />
                                        Find in Chocolatey
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
