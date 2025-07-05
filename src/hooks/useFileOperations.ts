import { useState, Dispatch, SetStateAction } from 'react'
import { TabType } from '@/types'

interface FileOperationsProps {
    addLog: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void
    setSelectedTab: Dispatch<SetStateAction<TabType>>
}

export const useFileOperations = ({ addLog, setSelectedTab }: FileOperationsProps) => {
    const [selectedPackageFile, setSelectedPackageFile] = useState<string | null>(null)
    const [selectedConfigFile, setSelectedConfigFile] = useState<string | null>(null)
    const [editingFile, setEditingFile] = useState<string | null>(null)

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
                const filePath = result.filePaths[0]
                setSelectedConfigFile(filePath)
                addLog(`Selected config file: ${filePath}`, 'info')
                return filePath
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
                const filePath = result.filePaths[0]
                setSelectedPackageFile(filePath)
                addLog(`Selected package file: ${filePath}`, 'info')
                return filePath
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

    const detectDefaultFiles = async () => {
        if (!window.electronAPI) return

        try {
            const appPath = await window.electronAPI.getAppPath()
            const defaultPackageFile = `${appPath}\\packages.txt`
            const packageFileExists = await window.electronAPI.fileExists(defaultPackageFile)

            if (packageFileExists) {
                setSelectedPackageFile(defaultPackageFile)
                addLog(`Auto-detected package file: ${defaultPackageFile}`, 'info')
            }

            const defaultConfigFile = `${appPath}\\configs.zip`
            const configFileExists = await window.electronAPI.fileExists(defaultConfigFile)

            if (configFileExists) {
                setSelectedConfigFile(defaultConfigFile)
                addLog(`Auto-detected config file: ${defaultConfigFile}`, 'info')
            }
        } catch (error) {
            addLog(`Could not auto-detect files: ${error}`, 'warning')
        }
    }

    return {
        selectedPackageFile,
        selectedConfigFile,
        editingFile,
        setEditingFile,
        selectPackageFile,
        selectConfigFile,
        editPackageFile,
        editConfigMappings,
        detectDefaultFiles
    }
}
