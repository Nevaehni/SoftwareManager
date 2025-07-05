import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Monitor } from 'lucide-react'

interface AppHeaderProps {
    isRunning: boolean
    progress: number
    onSystemInfoClick: () => void
}

export const AppHeader = ({ isRunning, progress, onSystemInfoClick }: AppHeaderProps) => {
    return (
        <header className="border-b p-3 flex-shrink-0">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Software Manager</h1>
                    <p className="text-sm text-muted-foreground">
                        Chocolatey package and configuration management
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={onSystemInfoClick}
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
    )
}
