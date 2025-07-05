import { useState } from 'react'

interface OperationsProps {
    addLog: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void
}

export const useOperations = ({ addLog }: OperationsProps) => {
    const [isRunning, setIsRunning] = useState(false)
    const [progress, setProgress] = useState(0)
    const [isSystemInfoModalOpen, setIsSystemInfoModalOpen] = useState(false)

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

    return {
        isRunning,
        progress,
        executeOperation,
        isSystemInfoModalOpen,
        setIsSystemInfoModalOpen,
    }
}
