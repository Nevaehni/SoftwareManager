import { useState } from 'react'
import { OperationLog } from '@/types'
import { formatLogMessage } from '@/lib/file-utils'

export const useConsole = () => {
    const [logs, setLogs] = useState<OperationLog[]>([])
    const [isConsoleVisible, setIsConsoleVisible] = useState(false)

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
    }

    const copyAllLogs = async () => {
        if (logs.length === 0) {
            addLog('No logs to copy', 'warning')
            return
        }

        const logText = formatLogMessage(logs)

        try {
            await navigator.clipboard.writeText(logText)
            addLog('All logs copied to clipboard', 'success')
        } catch (error) {
            addLog(`Failed to copy logs: ${error}`, 'error')
        }
    }

    return {
        logs,
        isConsoleVisible,
        setIsConsoleVisible,
        addLog,
        clearLogs,
        copyAllLogs
    }
}
