import { FileDisplayInfo } from '@/types'

export const formatLogMessage = (logs: any[]): string => {
    return logs.map(log => `[${log.timestamp}] ${log.message}`).join('\n')
}

export const getDisplayFileName = (filePath: string | null): FileDisplayInfo | null => {
    if (!filePath) return null;
    const fileName = filePath.split('\\').pop() || filePath.split('/').pop() || filePath;
    const directory = filePath.substring(0, filePath.lastIndexOf('\\') || filePath.lastIndexOf('/'));
    return { fileName, directory, fullPath: filePath };
};
