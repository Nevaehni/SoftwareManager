import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, Plus } from 'lucide-react'
import { ChocolateyPackage } from '@/types'

interface PackageSearchCardProps {
    searchQuery: string
    searchResults: ChocolateyPackage[]
    isSearching: boolean
    selectedPackageFile: string | null
    includeConfig: boolean
    onSearchQueryChange: (query: string) => void
    onSearch: () => void
    onIncludeConfigChange: (include: boolean) => void
    onAddPackage: (packageName: string, includeConfig: boolean) => void
}

export const PackageSearchCard = ({
    searchQuery,
    searchResults,
    isSearching,
    selectedPackageFile,
    includeConfig,
    onSearchQueryChange,
    onSearch,
    onIncludeConfigChange,
    onAddPackage
}: PackageSearchCardProps) => {
    return (
        <Card className="p-4 h-full flex flex-col">            <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Search Packages
                </CardTitle>
                <CardDescription>
                    Find and add packages to your package list
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 min-h-0">
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search for packages..."
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && onSearch()}
                        className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSearching}
                    />
                    <Button
                        onClick={onSearch}
                        disabled={isSearching || !searchQuery.trim()}
                    >
                        <Search className="h-4 w-4" />
                    </Button>
                </div>

                {!selectedPackageFile && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                            Please select a package file first to add packages to your list.
                        </p>
                    </div>
                )}

                {/* Include Config Checkbox */}
                <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg">
                    <input
                        type="checkbox"
                        id="includeConfig"
                        checked={includeConfig}
                        onChange={(e) => onIncludeConfigChange(e.target.checked)}
                        className="rounded border-gray-300"
                    />
                    <label htmlFor="includeConfig" className="text-sm font-medium cursor-pointer">
                        Include config prefix
                    </label>                </div>

                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                    {isSearching && (
                        <div className="text-center py-8">
                            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="mt-2 text-muted-foreground">Searching packages...</p>
                        </div>
                    )}

                    {!isSearching && searchResults.length === 0 && searchQuery && (
                        <div className="text-center py-8 text-muted-foreground">
                            No packages found. Try a different search term.
                        </div>
                    )}

                    {searchResults.map((pkg, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-2">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium">{pkg.title}</h4>
                                    <p className="text-sm text-muted-foreground">v{pkg.version}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{pkg.summary}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => onAddPackage(pkg.name, includeConfig)}
                                    disabled={!selectedPackageFile}
                                    className="w-full"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Package{includeConfig ? ' + Config' : ''}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
