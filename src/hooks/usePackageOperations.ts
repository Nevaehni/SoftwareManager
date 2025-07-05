import { useState } from 'react'
import { ChocolateyPackage, InstalledProgram, PackageStats } from '@/types'

interface PackageOperationsProps {
    addLog: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void
    showError: (message: string, title?: string) => void
    showSuccess: (message: string, title?: string) => void
    showInfo: (message: string, title?: string) => void
    selectedPackageFile: string | null
}

export const usePackageOperations = ({
    addLog,
    showError,
    showSuccess,
    showInfo,
    selectedPackageFile,
}: PackageOperationsProps) => {
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<ChocolateyPackage[]>([])
    const [installedPrograms, setInstalledPrograms] = useState<InstalledProgram[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isLoadingPrograms, setIsLoadingPrograms] = useState(false)
    const [packageStats, setPackageStats] = useState<PackageStats | null>(null)
    const [isLoadingStats, setIsLoadingStats] = useState(false)
    const [includeConfig, setIncludeConfig] = useState(false)

    // Package matching modal state
    const [selectedProgramForMatching, setSelectedProgramForMatching] = useState<InstalledProgram | null>(null)
    const [matchingSearchQuery, setMatchingSearchQuery] = useState('')
    const [matchingSearchResults, setMatchingSearchResults] = useState<ChocolateyPackage[]>([])
    const [isMatchingSearching, setIsMatchingSearching] = useState(false)

    const searchChocolateyPackages = async () => {
        if (!window.electronAPI || !searchQuery.trim()) return

        setIsSearching(true)
        addLog(`Searching for packages matching: ${searchQuery}`, 'info')

        try {
            const appPath = await window.electronAPI.getAppPath()
            const scriptPath = `${appPath}\\powershell\\SearchPackages.ps1`

            const result = await window.electronAPI.executePowerShell(scriptPath, [
                '-SearchTerm', searchQuery,
                '-MaxResults', '25'
            ])

            if (result.success && result.stdout) {
                try {
                    const searchData = JSON.parse(result.stdout)

                    if (searchData.Success && searchData.Packages) {
                        const packages: ChocolateyPackage[] = searchData.Packages.map((pkg: any) => ({
                            name: pkg.Id,
                            title: pkg.Title || pkg.Id,
                            summary: pkg.Summary || 'No description available',
                            version: pkg.Version
                        }))

                        setSearchResults(packages)
                        addLog(`Found ${packages.length} packages`, 'success')
                    } else {
                        addLog(searchData.Error || 'No packages found', 'warning')
                        setSearchResults([])
                    }
                } catch (parseError) {
                    // Fallback to old method if JSON parsing fails
                    const packages: ChocolateyPackage[] = []
                    const lines = result.stdout.split('\n').filter(line => line.trim())

                    for (const line of lines) {
                        const parts = line.split('|')
                        if (parts.length >= 2) {
                            packages.push({
                                name: parts[0],
                                title: parts[0],
                                summary: parts.length > 2 ? parts[2] : 'No description available',
                                version: parts[1]
                            })
                        }
                    }

                    setSearchResults(packages)
                    addLog(`Found ${packages.length} packages (fallback method)`, 'success')
                }
            } else {
                addLog('No packages found or Chocolatey not available', 'warning')
                setSearchResults([])
            }
        } catch (error) {
            addLog(`Error searching packages: ${error}`, 'error')
            setSearchResults([])
        } finally {
            setIsSearching(false)
        }
    }

    const addPackageToList = async (packageName: string, includeConfig: boolean) => {
        if (!selectedPackageFile || !window.electronAPI) {
            showError('No package file selected', 'Package Addition Failed')
            addLog('No package file selected', 'error')
            return
        }

        try {
            showInfo(`Adding ${packageName}${includeConfig ? ' with config backup' : ''} to package list...`, 'Processing')

            const appPath = await window.electronAPI.getAppPath()
            const scriptPath = `${appPath}\\powershell\\AddPackage.ps1`

            const args = [
                '-PackageName', packageName,
                '-PackagesFile', selectedPackageFile,
                '-ValidatePackage'
            ]

            if (includeConfig) {
                args.push('-IncludeConfig')
            }

            const result = await window.electronAPI.executePowerShell(scriptPath, args)

            if (result.success && result.stdout) {
                try {
                    const addResult = JSON.parse(result.stdout)

                    if (addResult.Success) {
                        const configText = addResult.WithConfig ? ' with config backup' : ''
                        const updateText = addResult.Updated ? ' (updated)' : ''
                        const successMessage = `${packageName}${configText} has been added to your package list${updateText}`

                        showSuccess(successMessage, 'Package Added Successfully')
                        addLog(`Added ${packageName}${configText} to package list${updateText}`, 'success')
                    } else {
                        const errorMessage = addResult.Error || `Failed to add ${packageName}`
                        showError(errorMessage, 'Package Addition Failed')
                        addLog(errorMessage, 'error')
                    }
                } catch (parseError) {
                    const successMessage = `${includeConfig ? '+' : ''}${packageName} has been added to your package list`
                    showSuccess(successMessage, 'Package Added')
                    addLog(successMessage, 'success')
                }
            } else {
                // Fallback to old method if script fails
                const content = await window.electronAPI.readFile(selectedPackageFile)
                const packageEntry = includeConfig ? `+${packageName}` : packageName
                const newContent = content + '\n' + packageEntry
                await window.electronAPI.writeFile(selectedPackageFile, newContent)

                const successMessage = `${packageEntry} has been added to your package list`
                showSuccess(successMessage, 'Package Added')
                addLog(successMessage, 'success')
            }
        } catch (error) {
            const errorMessage = `Error adding package to list: ${error}`
            showError(errorMessage, 'Package Addition Failed')
            addLog(errorMessage, 'error')
        }
    }

    const loadInstalledPrograms = async () => {
        if (!window.electronAPI) return

        setIsLoadingPrograms(true)
        addLog('Loading installed programs...', 'info')

        try {
            // First load Chocolatey packages
            const chocolateyPackages = await loadInstalledChocolateyPackages()

            const appPath = await window.electronAPI.getAppPath()
            const scriptPath = `${appPath}\\powershell\\GetInstalledPrograms.ps1`

            const result = await window.electronAPI.executePowerShell(scriptPath, ['-Format', 'JSON'])

            if (result.success && result.stdout) {
                try {
                    const programsData = JSON.parse(result.stdout)

                    if (programsData.Success && programsData.Programs) {
                        const programList: InstalledProgram[] = programsData.Programs.map((prog: any) => {
                            const programName = prog.Name || 'Unknown'
                            const match = matchProgramWithChocolatey(programName, chocolateyPackages)

                            return {
                                name: programName,
                                version: prog.Version || 'Unknown',
                                publisher: prog.Publisher || 'Unknown',
                                isChocolateyPackage: !!match,
                                chocolateyName: match?.name
                            }
                        })

                        setInstalledPrograms(programList.sort((a, b) => a.name.localeCompare(b.name)))
                        addLog(`Loaded ${programList.length} installed programs (${programList.filter(p => p.isChocolateyPackage).length} via Chocolatey)`, 'success')
                    } else {
                        addLog(programsData.Error || 'No programs found', 'warning')
                        setInstalledPrograms([])
                    }
                } catch (parseError) {
                    addLog('Using fallback method to load programs...', 'info')

                    // Fallback to old WMI method if JSON parsing fails
                    const fallbackResult = await window.electronAPI.executePowerShell('wmic product get name,version,vendor /format:csv', [])

                    if (fallbackResult.success && fallbackResult.stdout) {
                        const lines = fallbackResult.stdout.split('\n').filter(line => line.trim() && !line.startsWith('Node,'))
                        const programList: InstalledProgram[] = []

                        for (const line of lines) {
                            const parts = line.split(',')
                            if (parts.length >= 4) {
                                const name = parts[1]?.trim()
                                const vendor = parts[2]?.trim()
                                const version = parts[3]?.trim()

                                if (name && name !== 'Name') {
                                    const match = matchProgramWithChocolatey(name, chocolateyPackages)

                                    programList.push({
                                        name: name || 'Unknown',
                                        version: version || 'Unknown',
                                        publisher: vendor || 'Unknown',
                                        isChocolateyPackage: !!match,
                                        chocolateyName: match?.name
                                    })
                                }
                            }
                        }

                        setInstalledPrograms(programList.sort((a, b) => a.name.localeCompare(b.name)))
                        addLog(`Loaded ${programList.length} installed programs (fallback) (${programList.filter(p => p.isChocolateyPackage).length} via Chocolatey)`, 'success')
                    } else {
                        addLog('Could not retrieve installed programs', 'warning')
                        setInstalledPrograms([])
                    }
                }
            } else {
                addLog('Could not retrieve installed programs', 'warning')
                setInstalledPrograms([])
            }
        } catch (error) {
            addLog(`Error loading installed programs: ${error}`, 'error')
            setInstalledPrograms([])
        } finally {
            setIsLoadingPrograms(false)
        }
    }

    const loadInstalledChocolateyPackages = async () => {
        if (!window.electronAPI) return []

        try {
            addLog('Loading installed Chocolatey packages...', 'info')

            const result = await window.electronAPI.executePowerShell('choco list --local-only --limit-output', [])

            if (result.success && result.stdout) {
                const packages: ChocolateyPackage[] = []
                const lines = result.stdout.split('\n').filter(line => line.trim())

                for (const line of lines) {
                    const parts = line.split('|')
                    if (parts.length >= 2) {
                        packages.push({
                            name: parts[0].trim(),
                            title: parts[0].trim(),
                            summary: 'Installed via Chocolatey',
                            version: parts[1].trim()
                        })
                    }
                }

                addLog(`Found ${packages.length} installed Chocolatey packages`, 'success')
                return packages
            } else {
                addLog('Could not load Chocolatey packages or Chocolatey not available', 'warning')
                return []
            }
        } catch (error) {
            addLog(`Error loading Chocolatey packages: ${error}`, 'error')
            return []
        }
    }

    const matchProgramWithChocolatey = (programName: string, chocolateyPackages: ChocolateyPackage[]) => {
        const normalizedProgramName = programName.toLowerCase().trim()

        // Try exact match first
        let match = chocolateyPackages.find(pkg =>
            pkg.name.toLowerCase() === normalizedProgramName ||
            pkg.title.toLowerCase() === normalizedProgramName
        )

        if (match) return match

        // Try partial match (program name contains chocolatey name or vice versa)
        match = chocolateyPackages.find(pkg => {
            const pkgName = pkg.name.toLowerCase()
            const pkgTitle = pkg.title.toLowerCase()

            return normalizedProgramName.includes(pkgName) ||
                pkgName.includes(normalizedProgramName) ||
                normalizedProgramName.includes(pkgTitle) ||
                pkgTitle.includes(normalizedProgramName)
        })

        return match
    }

    const searchChocolateyForProgram = async (programName: string) => {
        if (!window.electronAPI || !programName.trim()) return

        setIsMatchingSearching(true)
        setMatchingSearchQuery(programName)
        addLog(`Searching Chocolatey for: ${programName}`, 'info')

        try {
            const appPath = await window.electronAPI.getAppPath()
            const scriptPath = `${appPath}\\powershell\\SearchPackages.ps1`

            const result = await window.electronAPI.executePowerShell(scriptPath, [
                '-SearchTerm', programName,
                '-MaxResults', '10'
            ])

            if (result.success && result.stdout) {
                try {
                    const searchData = JSON.parse(result.stdout)

                    if (searchData.Success && searchData.Packages) {
                        const packages: ChocolateyPackage[] = searchData.Packages.map((pkg: any) => ({
                            name: pkg.Id,
                            title: pkg.Title || pkg.Id,
                            summary: pkg.Summary || 'No description available',
                            version: pkg.Version
                        }))

                        setMatchingSearchResults(packages)
                        addLog(`Found ${packages.length} potential matches for ${programName}`, 'success')
                    } else {
                        addLog(searchData.Error || 'No matches found', 'warning')
                        setMatchingSearchResults([])
                    }
                } catch (parseError) {
                    addLog('Error parsing search results', 'error')
                    setMatchingSearchResults([])
                }
            } else {
                addLog('No matches found or Chocolatey not available', 'warning')
                setMatchingSearchResults([])
            }
        } catch (error) {
            addLog(`Error searching for program: ${error}`, 'error')
            setMatchingSearchResults([])
        } finally {
            setIsMatchingSearching(false)
        }
    }

    const addChocolateyPackageToList = async (chocolateyName: string, programName: string) => {
        if (!selectedPackageFile || !window.electronAPI) {
            showError('No package file selected', 'Package Addition Failed')
            return
        }

        try {
            showInfo(`Adding ${chocolateyName} to package list...`, 'Processing')

            const appPath = await window.electronAPI.getAppPath()
            const scriptPath = `${appPath}\\powershell\\AddPackage.ps1`

            const args = [
                '-PackageName', chocolateyName,
                '-PackagesFile', selectedPackageFile,
                '-ValidatePackage'
            ]

            if (includeConfig) {
                args.push('-IncludeConfig')
            }

            const result = await window.electronAPI.executePowerShell(scriptPath, args)

            if (result.success && result.stdout) {
                try {
                    const addResult = JSON.parse(result.stdout)

                    if (addResult.Success) {
                        const configText = addResult.WithConfig ? ' with config backup' : ''
                        const updateText = addResult.Updated ? ' (updated)' : ''
                        const successMessage = `${chocolateyName}${configText} (for ${programName}) has been added${updateText}`

                        showSuccess(successMessage, 'Package Added Successfully')
                        addLog(`Added ${chocolateyName} (for ${programName}) to package list${updateText}`, 'success')
                    } else {
                        const errorMessage = addResult.Error || `Failed to add ${chocolateyName}`
                        showError(errorMessage, 'Package Addition Failed')
                        addLog(errorMessage, 'error')
                    }
                } catch (parseError) {
                    const successMessage = `${includeConfig ? '+' : ''}${chocolateyName} (for ${programName}) has been added to your package list`
                    showSuccess(successMessage, 'Package Added')
                    addLog(successMessage, 'success')
                }
            } else {
                // Fallback to old method
                const content = await window.electronAPI.readFile(selectedPackageFile)
                const packageEntry = includeConfig ? `+${chocolateyName}` : chocolateyName
                const newContent = content + '\n' + packageEntry
                await window.electronAPI.writeFile(selectedPackageFile, newContent)

                const successMessage = `${packageEntry} (for ${programName}) has been added to your package list`
                showSuccess(successMessage, 'Package Added')
                addLog(successMessage, 'success')
            }
        } catch (error) {
            const errorMessage = `Error adding package to list: ${error}`
            showError(errorMessage, 'Package Addition Failed')
            addLog(errorMessage, 'error')
        }
    }

    const loadPackageStats = async () => {
        if (!window.electronAPI) return

        setIsLoadingStats(true)
        addLog('Loading package statistics...', 'info')

        try {
            const appPath = await window.electronAPI.getAppPath()
            const scriptPath = `${appPath}\\powershell\\GetPackageStats.ps1`

            const result = await window.electronAPI.executePowerShell(scriptPath, ['-Format', 'JSON'])

            if (result.success && result.stdout) {
                try {
                    const statsData = JSON.parse(result.stdout)

                    const stats: PackageStats = {
                        success: true,
                        chocolatey: {
                            available: statsData.Chocolatey?.Available || false,
                            version: statsData.Chocolatey?.Version || '',
                            installedPackages: statsData.Chocolatey?.InstalledPackages || 0
                        },
                        packagesFile: {
                            exists: statsData.PackagesFile?.Exists || false,
                            totalPackages: statsData.PackagesFile?.TotalPackages || 0,
                            configPackages: statsData.PackagesFile?.ConfigPackages || 0
                        },
                        installedPrograms: {
                            registry: statsData.InstalledPrograms?.Registry || 0,
                            store: statsData.InstalledPrograms?.Store || 0
                        },
                        system: {
                            isAdmin: statsData.System?.IsAdmin || false,
                            psVersion: statsData.System?.PSVersion || '',
                            os: statsData.System?.OS || ''
                        }
                    }

                    setPackageStats(stats)
                    addLog('Package statistics loaded successfully', 'success')
                } catch (parseError) {
                    addLog('Error parsing package statistics', 'error')
                    setPackageStats(null)
                }
            } else {
                addLog('Could not load package statistics', 'warning')
                setPackageStats(null)
            }
        } catch (error) {
            addLog(`Error loading package statistics: ${error}`, 'error')
            setPackageStats(null)
        } finally {
            setIsLoadingStats(false)
        }
    }

    return {
        // State
        searchQuery,
        searchResults,
        installedPrograms,
        isSearching,
        isLoadingPrograms,
        packageStats,
        isLoadingStats,
        includeConfig,
        selectedProgramForMatching,
        matchingSearchQuery,
        matchingSearchResults,
        isMatchingSearching,

        // Setters
        setSearchQuery,
        setIncludeConfig,
        setSelectedProgramForMatching,
        setMatchingSearchResults,
        setMatchingSearchQuery,

        // Actions
        searchChocolateyPackages,
        addPackageToList,
        loadInstalledPrograms,
        searchChocolateyForProgram,
        addChocolateyPackageToList,
        loadPackageStats
    }
}
