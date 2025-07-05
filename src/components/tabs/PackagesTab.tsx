import { PackageSearchCard } from './PackageSearchCard'
import { InstalledProgramsCard } from './InstalledProgramsCard'
import { ChocolateyPackage, InstalledProgram } from '@/types'

interface PackagesTabProps {
    // Search state
    searchQuery: string
    searchResults: ChocolateyPackage[]
    isSearching: boolean

    // Installed programs state
    installedPrograms: InstalledProgram[]
    isLoadingPrograms: boolean

    // General state
    selectedPackageFile: string | null
    includeConfig: boolean

    // Actions
    onSearchQueryChange: (query: string) => void
    onSearch: () => void
    onIncludeConfigChange: (include: boolean) => void
    onAddPackage: (packageName: string, includeConfig: boolean) => void
    onLoadPrograms: () => void
    onAddToList: (chocolateyName: string, programName: string) => void
    onSearchForProgram: (program: InstalledProgram) => void
}

export const PackagesTab = ({
    searchQuery,
    searchResults,
    isSearching,
    installedPrograms,
    isLoadingPrograms,
    selectedPackageFile,
    includeConfig,
    onSearchQueryChange,
    onSearch,
    onIncludeConfigChange,
    onAddPackage,
    onLoadPrograms,
    onAddToList,
    onSearchForProgram
}: PackagesTabProps) => {
    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <PackageSearchCard
                        searchQuery={searchQuery}
                        searchResults={searchResults}
                        isSearching={isSearching}
                        selectedPackageFile={selectedPackageFile}
                        includeConfig={includeConfig}
                        onSearchQueryChange={onSearchQueryChange}
                        onSearch={onSearch}
                        onIncludeConfigChange={onIncludeConfigChange}
                        onAddPackage={onAddPackage}
                    />

                    <InstalledProgramsCard
                        installedPrograms={installedPrograms}
                        isLoadingPrograms={isLoadingPrograms}
                        selectedPackageFile={selectedPackageFile}
                        includeConfig={includeConfig}
                        onLoadPrograms={onLoadPrograms}
                        onAddToList={onAddToList}
                        onSearchForProgram={onSearchForProgram}
                    />
                </div>
            </div>
        </div>
    )
}
