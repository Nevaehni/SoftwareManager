import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Search, Plus, ExternalLink } from 'lucide-react'

interface ChocolateyPackage {
    name: string
    title: string
    summary: string
    version: string
}

interface InstalledProgram {
    name: string
    version: string
    publisher: string
    isChocolateyPackage: boolean
    chocolateyName?: string
}

interface PackageMatchingModalProps {
    open: boolean
    onClose: () => void
    program: InstalledProgram | null
    searchResults: ChocolateyPackage[]
    isSearching: boolean
    searchQuery: string
    onSearch: (query: string) => void
    onAddToList: (chocolateyName: string, programName: string) => void
    includeConfig: boolean
}

export function PackageMatchingModal({
    open,
    onClose,
    program,
    searchResults,
    isSearching,
    searchQuery,
    onSearch,
    onAddToList,
    includeConfig
}: PackageMatchingModalProps) {
    const [localSearchQuery, setLocalSearchQuery] = useState('')

    const handleSearch = () => {
        if (localSearchQuery.trim()) {
            onSearch(localSearchQuery.trim())
        }
    }

    const handleAddPackage = (chocolateyName: string) => {
        if (program) {
            onAddToList(chocolateyName, program.name)
            onClose()
        }
    }

    if (!program) return null

    return (
        <Modal open={open} onClose={onClose}>
            <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-semibold">Find Chocolatey Package</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Find the correct Chocolatey package for: <span className="font-medium">{program.name}</span>
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder={`Search for "${program.name}" or related packages...`}
                            value={localSearchQuery}
                            onChange={(e) => setLocalSearchQuery(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isSearching}
                        />
                        <Button
                            onClick={handleSearch}
                            disabled={isSearching || !localSearchQuery.trim()}
                        >
                            <Search className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="text-sm text-muted-foreground">
                        Current search: <span className="font-mono">{searchQuery || 'None'}</span>
                    </div>

                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {isSearching && (
                            <div className="text-center py-8">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                <p className="mt-2 text-muted-foreground">Searching for packages...</p>
                            </div>
                        )}

                        {!isSearching && searchResults.length === 0 && searchQuery && (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>No packages found for "{searchQuery}"</p>
                                <p className="text-xs mt-1">Try a different search term or check the spelling</p>
                            </div>
                        )}

                        {!isSearching && !searchQuery && (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Search for Chocolatey packages that match "{program.name}"</p>
                                <p className="text-xs mt-1">The program name is pre-filled in the search box</p>
                            </div>
                        )}

                        {searchResults.map((pkg, index) => (
                            <div key={index} className="p-4 border rounded-lg space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-medium">{pkg.name}</h4>
                                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                v{pkg.version}
                                            </span>
                                        </div>
                                        {pkg.title !== pkg.name && (
                                            <p className="text-sm text-muted-foreground mt-1">{pkg.title}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-1">{pkg.summary}</p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        onClick={() => handleAddPackage(pkg.name)}
                                        className="flex-1"
                                    >
                                        <Plus className="h-3 w-3 mr-1" />
                                        Add {includeConfig ? '+ Config' : 'Package'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open(`https://chocolatey.org/packages/${pkg.name}`, '_blank')}
                                    >
                                        <ExternalLink className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t bg-muted/30">
                    <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    )
}
