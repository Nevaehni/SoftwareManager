import { Button } from '@/components/ui/button'
import { Copy, EyeOff, Eye } from 'lucide-react'
import { OperationLog } from '@/types'

interface ConsolePanelProps {
    logs: OperationLog[]
    isVisible: boolean
    onToggleVisibility: () => void
    onCopyAllLogs: () => void
    onClearLogs: () => void
}

export const ConsolePanel = ({
    logs,
    isVisible,
    onToggleVisibility,
    onCopyAllLogs,
    onClearLogs
}: ConsolePanelProps) => {
    if (!isVisible) {
        return (
            <div className="fixed bottom-4 right-4 z-50">
                <Button
                    onClick={onToggleVisibility}
                    size="sm"
                    variant="outline"
                    className="bg-background shadow-lg border-2"
                >
                    <Eye className="h-4 w-4 mr-2" />
                    Show Console
                </Button>
            </div>
        )
    }

    return (
        <div className="h-48 border-t">
            <div className="h-full flex flex-col">
                <div className="p-3 border-b bg-muted/30">
                    <div className="flex items-center justify-between">
                        <h3 className="font-medium">Console Output</h3>
                        <div className="flex gap-2">
                            <Button onClick={onCopyAllLogs} size="sm" variant="outline" disabled={logs.length === 0}>
                                <Copy className="h-4 w-4" />
                            </Button>
                            <Button onClick={onClearLogs} size="sm" variant="outline">
                                Clear
                            </Button>
                            <Button onClick={onToggleVisibility} size="sm" variant="outline">
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
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
