import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Download, Upload, Package, FolderOpen, Copy, Edit3, FileText } from 'lucide-react'
import { FileEditor } from '@/components/FileEditor'

interface OperationLog {
  timestamp: string
  message: string
  type: 'info' | 'error' | 'success' | 'warning'
}

function App() {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<OperationLog[]>([])
  const [selectedTab, setSelectedTab] = useState('backup')
  const [selectedPackageFile, setSelectedPackageFile] = useState<string | null>(null)
  const [selectedConfigFile, setSelectedConfigFile] = useState<string | null>(null)
  const [editingFile, setEditingFile] = useState<string | null>(null)

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

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b p-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Software Manager</h1>
            <p className="text-sm text-muted-foreground">
              Chocolatey package and configuration management
            </p>
          </div>          <div className="flex items-center gap-3">
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
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar Navigation */}
        <div className="w-64 border-r bg-muted/30 flex flex-col">          <nav className="p-4 space-y-2">
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
          </Button>        </nav>

          {/* Files Section in Sidebar */}
          <div className="p-4 border-t">
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
        <div className="flex-1 flex flex-col">
          {selectedTab === 'editor' ? (
            /* Editor Mode */
            editingFile ? (
              <div className="flex-1">
                <FileEditor
                  filePath={editingFile}
                  onLog={addLog}
                  onClose={() => setEditingFile(null)}
                />
              </div>
            ) : (
              /* File Selection */
              <div className="flex-1 p-8">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center">
                      <Edit3 className="h-8 w-8 text-purple-600" />
                    </div>
                    <h2 className="text-2xl font-bold">File Editor</h2>
                    <p className="text-muted-foreground">Select a file to edit</p>
                  </div>

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
            <div className="flex-1 p-8">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                  <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                    <Upload className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold">Backup Configurations</h2>
                  <p className="text-muted-foreground">Export application settings from this PC</p>
                </div>

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
                          Package file: <span className="font-medium">{getDisplayFileName(selectedPackageFile)?.fileName}</span>
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
          ) : selectedTab === 'restore' ? (
            /* Restore Mode */
            <div className="flex-1 p-8">
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Download className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold">Install & Restore</h2>
                  <p className="text-muted-foreground">Set up a new PC with your applications</p>
                </div>

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
            <div className="flex-1 p-8">
              <div className="max-w-4xl mx-auto space-y-8">                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-8 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-blue-200" onClick={() => {
                  setSelectedTab('backup')
                  setEditingFile(null)
                }}>
                  <div className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <Upload className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Backup Configurations</h3>
                      <p className="text-muted-foreground mt-2">
                        Export application settings from this PC
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
            </div>
          )}          {/* Console Panel - always visible */}
          <div className="h-48 border-t">
            <div className="h-full flex flex-col">
              <div className="p-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Console Output ({logs.length})</h3>
                  <div className="flex gap-2">
                    <Button onClick={copyAllLogs} size="sm" variant="outline" disabled={logs.length === 0}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button onClick={clearLogs} size="sm" variant="outline">
                      Clear
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
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
