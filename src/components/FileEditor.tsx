import { useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Save, RotateCcw, Edit3, X } from 'lucide-react'

interface FileEditorProps {
  filePath: string | null
  onLog: (message: string, type: 'info' | 'error' | 'success' | 'warning') => void
  onClose?: () => void
}

export function FileEditor({ filePath, onLog, onClose }: FileEditorProps) {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [isModified, setIsModified] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const loadFile = async () => {
    if (!filePath || !window.electronAPI) return

    setIsLoading(true)
    try {
      const content = await window.electronAPI.readFile(filePath)
      setContent(content)
      setOriginalContent(content)
      setIsModified(false)
      onLog(`Loaded file: ${filePath}`, 'info')
    } catch (error) {
      onLog(`Error loading file: ${error}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }
  const saveFile = async () => {
    if (!filePath || !window.electronAPI) return

    setIsSaving(true)
    try {
      await window.electronAPI.writeFile(filePath, content)
      setOriginalContent(content)
      setIsModified(false)
      onLog(`Saved file: ${filePath}`, 'success')
    } catch (error) {
      onLog(`Error saving file: ${error}`, 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const revertChanges = () => {
    setContent(originalContent)
    setIsModified(false)
    onLog('Reverted changes', 'info')
  }

  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || ''
    setContent(newContent)
    setIsModified(newContent !== originalContent)
  }

  useEffect(() => {
    if (filePath) {
      loadFile()
    } else {
      setContent('')
      setOriginalContent('')
      setIsModified(false)
    }
  }, [filePath])

  const getLanguage = (path: string | null) => {
    if (!path) return 'text'
    const ext = path.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'ps1':
        return 'powershell'
      case 'txt':
        return 'text'
      case 'json':
        return 'json'
      case 'xml':
        return 'xml'
      case 'js':
        return 'javascript'
      case 'ts':
        return 'typescript'
      default:
        return 'text'
    }
  }

  const getFileName = (path: string | null) => {
    if (!path) return 'No file selected'
    return path.split('\\').pop() || path.split('/').pop() || path
  }

  if (!filePath) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <Edit3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a file to edit</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Editor Header */}
      <div className="flex items-center justify-between py-2 px-3 border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4" />
          <span className="text-sm font-medium">
            {getFileName(filePath)}
            {isModified && <span className="text-amber-500 ml-1">•</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isModified && (
            <Button
              onClick={revertChanges}
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Revert
            </Button>
          )}
          <Button
            onClick={saveFile}
            disabled={!isModified || isSaving}
            size="sm"
            className="h-6 px-2 text-xs"
          >
            <Save className="h-3 w-3 mr-1" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          {onClose && (
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="h-6 px-1 text-xs"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading file...</div>
          </div>
        ) : (
          <Editor
            height="100%"
            language={getLanguage(filePath)}
            value={content}
            onChange={handleEditorChange}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              padding: { top: 12, bottom: 12 },
              renderWhitespace: 'selection',
              tabSize: 2,
              insertSpaces: true,
              contextmenu: false,
              folding: false,
            }}
          />
        )}
      </div>
    </div>
  )
}
