import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Download, Upload, Package, FolderOpen, Copy, Edit3, FileText, Search, Plus, Monitor, Eye, EyeOff } from 'lucide-react'
import { FileEditor } from '@/components/FileEditor'
import { ToastContainer, useToast } from '@/components/ui/toast-container'
import { SystemInfoModal } from '@/components/SystemInfoModal'
import { PackageMatchingModal } from '@/components/PackageMatchingModal'

interface OperationLog {
  timestamp: string
  message: string
  type: 'info' | 'error' | 'success' | 'warning'
}

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

interface PackageStats {
  success: boolean
  chocolatey: {
    available: boolean
    version: string
    installedPackages: number
  }
  packagesFile: {
    exists: boolean
    totalPackages: number
    configPackages: number
  }
  installedPrograms: {
    registry: number
    store: number
  }
  system: {
    isAdmin: boolean
    psVersion: string
    os: string
  }
}

function App() {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [selectedTab, setSelectedTab] = useState('backup')
  const [selectedPackageFile, setSelectedPackageFile] = useState<string | null>(null)
  const [selectedConfigFile, setSelectedConfigFile] = useState<string | null>(null)
  const [editingFile, setEditingFile] = useState<string | null>(null)  // Package management state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ChocolateyPackage[]>([])
  const [installedPrograms, setInstalledPrograms] = useState<InstalledProgram[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false)
  const [packageStats, setPackageStats] = useState<PackageStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  // Toast notifications
  const { toasts, removeToast, showSuccess, showError, showInfo } = useToast()  // System Info Modal state
  const [isSystemInfoModalOpen, setIsSystemInfoModalOpen] = useState(false)
  const [includeConfig, setIncludeConfig] = useState(false)
  // Console visibility state
  const [isConsoleVisible, setIsConsoleVisible] = useState(false)
  // Package matching modal state
  const [selectedProgramForMatching, setSelectedProgramForMatching] = useState<InstalledProgram | null>(null)
  const [matchingSearchQuery, setMatchingSearchQuery] = useState('')
  const [matchingSearchResults, setMatchingSearchResults] = useState<ChocolateyPackage[]>([])
  const [isMatchingSearching, setIsMatchingSearching] = useState(false)

  // Helper function to display file names nicely
  const getDisplayFileName = (filePath: string | null) => {
    if (!filePath) return null
    const fileName = filePath.split('\\').pop() || filePath.split('/').pop() || filePath
    const directory = filePath.substring(0, filePath.lastIndexOf('\\') || filePath.lastIndexOf('/'))
    return { fileName, directory, fullPath: filePath }
  }

  // Auto-detect default files
  const detectDefaultFiles = async () => {
    if (!window.electronAPI) return

    try {
      const appPath = await window.electronAPI.getAppPath()

      // Check for packages.txt in the app directory
      const defaultPackageFile = `${appPath}\\packages.txt`
      const packageFileExists = await window.electronAPI.fileExists(defaultPackageFile)

      if (packageFileExists) {
        setSelectedPackageFile(defaultPackageFile)
        addLog(`Auto-detected package file: ${defaultPackageFile}`, 'info')
      } else {
        addLog(`No default package file found at: ${defaultPackageFile}`, 'info')
      }

      // Check for configs.zip in the app directory
      const defaultConfigFile = `${appPath}\\configs.zip`
      const configFileExists = await window.electronAPI.fileExists(defaultConfigFile)

      if (configFileExists) {
        setSelectedConfigFile(defaultConfigFile)
        addLog(`Auto-detected config file: ${defaultConfigFile}`, 'info')
      } else {
        addLog(`No default config archive found at: ${defaultConfigFile}`, 'info')
      }
    } catch (error) {
      addLog(`Could not auto-detect files: ${error}`, 'warning')
    }
  }

  useEffect(() => {
    // Set up PowerShell output listeners
    if (window.electronAPI) {
      window.electronAPI.onPowerShellOutput((data: string) => {
        addLog(data.trim(), 'info')
      })

      window.electronAPI.onPowerShellError((data: string) => {
        addLog(data.trim(), 'error')
      })

      // Auto-detect default files on component mount
      detectDefaultFiles()
    }

    return () => {
      // Cleanup listeners
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('powershell-output')
        window.electronAPI.removeAllListeners('powershell-error')
      }
    }
  }, [])

  const addLog = (message: string, type: OperationLog['type']) => {
    if (message.trim()) {
      setLogs(prev => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        message,
        type
      }])
    }
  }

  const clearLogs = () => {
    setLogs([])
    setProgress(0)
  }

  const copyAllLogs = async () => {
    if (logs.length === 0) {
      addLog('No logs to copy', 'warning')
      return
    }

    const logText = logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n')

    try {
      await navigator.clipboard.writeText(logText)
      addLog('All logs copied to clipboard', 'success')
    } catch (error) {
      addLog(`Failed to copy logs: ${error}`, 'error')
    }
  }

  const executeOperation = async (mode: 'backup' | 'install') => {
    if (!window.electronAPI) {
      addLog('Electron API not available', 'error')
      return
    }

    setIsRunning(true)
    setProgress(0)
    addLog(`Starting ${mode} operation...`, 'info')

    try {
      const result = await window.electronAPI.executePowerShell('', ['-Mode', mode])

      if (result.success) {
        if (result.exitCode === 0) {
          addLog(`${mode} operation completed successfully`, 'success')
        } else if (result.exitCode === 1) {
          addLog(`${mode} operation completed with warnings`, 'warning')
        }
        setProgress(100)
      } else {
        addLog(`${mode} operation failed with exit code: ${result.exitCode}`, 'error')
        if (result.stderr) {
          addLog(result.stderr, 'error')
        }
      }
    } catch (error) {
      addLog(`Error executing PowerShell: ${error}`, 'error')
    } finally {
      setIsRunning(false)
    }
  }

  const selectConfigFile = async () => {
    if (!window.electronAPI) return

    try {
      const result = await window.electronAPI.selectFile({
        title: 'Select Configuration Archive',
        filters: [
          { name: 'ZIP Archives', extensions: ['zip'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        setSelectedConfigFile(result.filePaths[0])
        addLog(`Selected config file: ${result.filePaths[0]}`, 'info')
      }
    } catch (error) {
      addLog(`Error selecting file: ${error}`, 'error')
    }
  }

  const selectPackageFile = async () => {
    if (!window.electronAPI) return

    try {
      const result = await window.electronAPI.selectFile({
        title: 'Select Package List',
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        setSelectedPackageFile(result.filePaths[0])
        addLog(`Selected package file: ${result.filePaths[0]}`, 'info')
      }
    } catch (error) {
      addLog(`Error selecting file: ${error}`, 'error')
    }
  }
  const editPackageFile = () => {
    if (selectedPackageFile) {
      setEditingFile(selectedPackageFile)
      setSelectedTab('editor')
    }
  }
  const editConfigMappings = async () => {
    if (!window.electronAPI) return

    try {
      const appPath = await window.electronAPI.getAppPath()
      const configMappingsPath = `${appPath}\\powershell\\ConfigMappings.ps1`
      setEditingFile(configMappingsPath)
      setSelectedTab('editor')
    } catch (error) {
      addLog(`Could not open ConfigMappings.ps1: ${error}`, 'error')
    }
  }
  // Package management functions
  const searchChocolateyPackages = async () => {
    if (!window.electronAPI || !searchQuery.trim()) return

    setIsSearching(true)
    addLog(`Searching for packages matching: ${searchQuery}`, 'info')

    try {
      // Use the new SearchPackages.ps1 script
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
      // Show info toast while processing
      showInfo(`Adding ${packageName}${includeConfig ? ' with config backup' : ''} to package list...`, 'Processing')

      // Use the new AddPackage.ps1 script
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
          // Fallback success message if JSON parsing fails
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

      // Use the new GetInstalledPrograms.ps1 script
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
          // Fallback to old WMI method if JSON parsing fails
          addLog('Using fallback method to load programs...', 'info')

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

  // Function to load installed Chocolatey packages
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

  // Function to match program names with Chocolatey packages
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

  // Function to search Chocolatey for a specific program
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

  // Function to add a Chocolatey package name to packages.txt
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

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Software Manager</h1>
            <p className="text-sm text-muted-foreground">
              Chocolatey package and configuration management
            </p>
          </div>          <div className="flex items-center gap-3">
            <Button
              onClick={() => setIsSystemInfoModalOpen(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Monitor className="h-4 w-4" />
              System Info
            </Button>
            {isRunning && (
              <>
                <span className="text-sm text-muted-foreground">Operation in progress...</span>
                <Progress value={progress} className="w-32" />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar Navigation */}
        <div className="w-64 border-r bg-muted/30 flex flex-col flex-shrink-0">          <nav className="p-4 space-y-2">
          <Button
            onClick={() => {
              setSelectedTab('backup')
              setEditingFile(null)
            }}
            variant={selectedTab === 'backup' ? 'default' : 'ghost'}
            className="w-full justify-start"
          >
            <Upload className="h-4 w-4 mr-2" />
            Backup
          </Button>
          <Button
            onClick={() => {
              setSelectedTab('restore')
              setEditingFile(null)
            }}
            variant={selectedTab === 'restore' ? 'default' : 'ghost'}
            className="w-full justify-start"
          >
            <Download className="h-4 w-4 mr-2" />
            Install & Restore
          </Button>          <Button
            onClick={() => {
              setSelectedTab('editor')
              setEditingFile(null)
            }}
            variant={selectedTab === 'editor' ? 'default' : 'ghost'}
            className="w-full justify-start"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            Editor
          </Button>
          <Button
            onClick={() => {
              setSelectedTab('packages')
              setEditingFile(null)
            }}
            variant={selectedTab === 'packages' ? 'default' : 'ghost'}
            className="w-full justify-start"
          >
            <Package className="h-4 w-4 mr-2" />
            Manage Packages
          </Button></nav>

          {/* Files Section in Sidebar */}
          <div className="p-4 border-t overflow-y-auto">
            <div className="text-xs font-medium text-muted-foreground mb-3">Quick Edit</div>

            {/* Package List */}
            {selectedPackageFile && (
              <div className="mb-3">
                <div className="text-xs text-muted-foreground mb-1">Package List</div>
                <div className="p-2 bg-background rounded text-xs">
                  <div className="font-medium">{getDisplayFileName(selectedPackageFile)?.fileName}</div>
                  <div className="text-muted-foreground truncate text-[10px]">{getDisplayFileName(selectedPackageFile)?.directory}</div>
                </div>
                <div className="flex gap-1 mt-1">
                  <Button onClick={editPackageFile} size="sm" variant="outline" className="flex-1 h-7 text-xs">
                    <Edit3 className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button onClick={selectPackageFile} size="sm" variant="outline" className="flex-1 h-7 text-xs">
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
                <Button onClick={editConfigMappings} size="sm" variant="outline" className="flex-1 h-7 text-xs">
                  <Edit3 className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </div>        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">          {selectedTab === 'editor' ? (
          /* Editor Mode */
          editingFile ? (
            <div className="flex-1 min-h-0">
              <FileEditor
                filePath={editingFile}
                onLog={addLog}
                onClose={() => setEditingFile(null)}
              />
            </div>
          ) : (
            /* File Selection */
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="space-y-4">
                  <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-200" onClick={editPackageFile}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                          <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold">Package List</div>
                          <div className="text-sm text-muted-foreground">
                            {selectedPackageFile ? getDisplayFileName(selectedPackageFile)?.fileName : 'No package file selected'}
                          </div>
                        </div>
                      </div>
                      <Edit3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Card>

                  <Card className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-purple-200" onClick={editConfigMappings}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                          <Edit3 className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <div className="font-semibold">Configuration Mappings</div>
                          <div className="text-sm text-muted-foreground">ConfigMappings.ps1</div>
                        </div>
                      </div>
                      <Edit3 className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )
        ) : selectedTab === 'backup' ? (
          /* Backup Mode */
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
              <Card className="p-6">
                <div className="space-y-4">
                  {!selectedPackageFile ? (
                    <div className="text-center space-y-4">
                      <div className="text-muted-foreground">No package file selected</div>
                      <Button onClick={selectPackageFile} variant="outline" size="lg">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Select Package File
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="text-center text-sm text-muted-foreground">
                        Using package file: <span className="font-medium">{getDisplayFileName(selectedPackageFile)?.fileName}</span>
                      </div>
                      <Button
                        onClick={() => executeOperation('backup')}
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
                  </p>
                </div>
              </Card>
            </div>
          </div>
        ) : selectedTab === 'packages' ? (
          /* Manage Packages Mode */
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold">Manage Packages</h2>
                <p className="text-muted-foreground">Search for new packages or view installed programs</p>
              </div>              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Chocolatey Package Search */}
                <Card className="p-6">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-2">
                      <Search className="h-5 w-5" />
                      Search Packages
                    </CardTitle>
                    <CardDescription>
                      Find and add packages to your package list
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Search for packages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchChocolateyPackages()}
                        className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSearching}
                      />
                      <Button
                        onClick={searchChocolateyPackages}
                        disabled={isSearching || !searchQuery.trim()}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>                    {!selectedPackageFile && (
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
                        onChange={(e) => setIncludeConfig(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="includeConfig" className="text-sm font-medium cursor-pointer">
                        Include config prefix
                      </label>
                    </div>

                    <div className="max-h-96 overflow-y-auto space-y-2">
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
                              <h4 className="font-medium truncate">{pkg.name}</h4>
                              <p className="text-sm text-muted-foreground">v{pkg.version}</p>
                              <p className="text-xs text-muted-foreground mt-1">{pkg.summary}</p>
                            </div>
                          </div>                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => addPackageToList(pkg.name, includeConfig)}
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

                {/* Installed Programs */}
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
                      onClick={loadInstalledPrograms}
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
                    </Button>                    <div className="max-h-96 overflow-y-auto space-y-2">
                      {installedPrograms.map((program, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium truncate">{program.name}</h4>
                                {program.isChocolateyPackage ? (
                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                    Chocolatey
                                  </span>
                                ) : (
                                  <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                                    System
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">v{program.version}</p>
                              <p className="text-xs text-muted-foreground">{program.publisher}</p>
                              {program.isChocolateyPackage && program.chocolateyName && (
                                <p className="text-xs text-blue-600 font-mono">{program.chocolateyName}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {program.isChocolateyPackage && program.chocolateyName ? (
                              <Button
                                size="sm"
                                onClick={() => addChocolateyPackageToList(program.chocolateyName!, program.name)}
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
                                onClick={() => {
                                  setSelectedProgramForMatching(program)
                                  setMatchingSearchQuery(program.name)
                                  searchChocolateyForProgram(program.name)
                                }}
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
              </div>
            </div>
          </div>
        ) : selectedTab === 'restore' ? (
          /* Restore Mode */
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
                            <div className="font-medium">{getDisplayFileName(selectedPackageFile)?.fileName}</div>
                            <div className="text-sm text-muted-foreground">{getDisplayFileName(selectedPackageFile)?.directory}</div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">No package file selected</div>
                        )}
                      </div>
                      <Button onClick={selectPackageFile} variant="outline">
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
                            <div className="font-medium">{getDisplayFileName(selectedConfigFile)?.fileName}</div>
                            <div className="text-sm text-muted-foreground">{getDisplayFileName(selectedConfigFile)?.directory}</div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">No config archive selected</div>
                        )}
                      </div>
                      <Button onClick={selectConfigFile} variant="outline">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Select Archive
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={() => executeOperation('install')}
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
        ) : (
          /* Home Dashboard */
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-8">                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">              <Card className="p-8 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-200" onClick={() => {
              setSelectedTab('backup')
              setEditingFile(null)
            }}>
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

              <Card className="p-8 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-green-200" onClick={() => {
                setSelectedTab('restore')
                setEditingFile(null)
              }}>
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

              <Card className="p-8 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-purple-200" onClick={editConfigMappings}>
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
                        <div className="font-semibold">{getDisplayFileName(selectedPackageFile)?.fileName}</div>
                        <div className="text-sm text-muted-foreground">Currently selected package list</div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={editPackageFile} variant="outline">
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button onClick={selectPackageFile} variant="outline">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Change
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>)}{/* Console Panel - conditionally visible */}
          {isConsoleVisible ? (
            <div className="h-48 border-t">
              <div className="h-full flex flex-col">
                <div className="p-3 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Console Output</h3>
                    <div className="flex gap-2">
                      <Button onClick={copyAllLogs} size="sm" variant="outline" disabled={logs.length === 0}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button onClick={clearLogs} size="sm" variant="outline">
                        Clear
                      </Button>
                      <Button onClick={() => setIsConsoleVisible(false)} size="sm" variant="outline">
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-slate-900 text-slate-100 p-3 overflow-y-auto font-mono text-sm">
                  {logs.length === 0 ? (
                    <div className="text-slate-400 text-center py-8">
                      Console is ready. Output from operations will appear here.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {logs.map((log, index) => (
                        <div
                          key={index}
                          className={`${log.type === 'error' ? 'text-red-400' :
                            log.type === 'success' ? 'text-green-400' :
                              log.type === 'warning' ? 'text-yellow-400' :
                                'text-slate-100'
                            }`}
                        >
                          <span className="text-slate-500">[{log.timestamp}]</span> {log.message}
                        </div>
                      ))}                    </div>
                  )}              </div>
              </div>
            </div>
          ) : (
            /* Show Console Button - Fixed position in bottom right */
            <div className="fixed bottom-4 right-4 z-50">
              <Button
                onClick={() => setIsConsoleVisible(true)}
                size="sm"
                variant="outline"
                className="bg-background shadow-lg border-2"
              >
                <Eye className="h-4 w-4 mr-2" />
                Show Console
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />      {/* System Info Modal */}
      <SystemInfoModal
        open={isSystemInfoModalOpen}
        onClose={() => setIsSystemInfoModalOpen(false)}
        packageStats={packageStats}
        isLoadingStats={isLoadingStats}
        onLoadStats={loadPackageStats}
      />

      {/* Package Matching Modal */}
      <PackageMatchingModal
        open={!!selectedProgramForMatching}
        onClose={() => {
          setSelectedProgramForMatching(null)
          setMatchingSearchResults([])
          setMatchingSearchQuery('')
        }}
        program={selectedProgramForMatching}
        searchResults={matchingSearchResults}
        isSearching={isMatchingSearching}
        searchQuery={matchingSearchQuery}
        onSearch={searchChocolateyForProgram}
        onAddToList={addChocolateyPackageToList}
        includeConfig={includeConfig}
      />
    </div>
  )
}

export default App
