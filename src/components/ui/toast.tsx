import * as React from "react"
import { cn } from "@/lib/utils"
import { X, CheckCircle, AlertCircle, XCircle, Info } from "lucide-react"

export interface ToastProps {
    id: string
    title?: string
    message: string
    type: 'success' | 'error' | 'warning' | 'info'
    duration?: number
    onClose?: () => void
}

const Toast = React.forwardRef<
    HTMLDivElement,
    ToastProps & React.HTMLAttributes<HTMLDivElement>
>(({ className, id, title, message, type, onClose, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(true)

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false)
            setTimeout(() => onClose?.(), 150) // Allow animation to complete
        }, 4000) // Show for 4 seconds

        return () => clearTimeout(timer)
    }, [onClose])

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <CheckCircle className="h-5 w-5 text-green-600" />
            case 'error':
                return <XCircle className="h-5 w-5 text-red-600" />
            case 'warning':
                return <AlertCircle className="h-5 w-5 text-yellow-600" />
            case 'info':
            default:
                return <Info className="h-5 w-5 text-blue-600" />
        }
    }

    const getBackgroundColor = () => {
        switch (type) {
            case 'success':
                return 'bg-green-50 border-green-200'
            case 'error':
                return 'bg-red-50 border-red-200'
            case 'warning':
                return 'bg-yellow-50 border-yellow-200'
            case 'info':
            default:
                return 'bg-blue-50 border-blue-200'
        }
    }

    return (
        <div
            ref={ref}
            className={cn(
                "flex items-start gap-3 p-4 rounded-lg border shadow-md transition-all duration-150 ease-in-out",
                getBackgroundColor(),
                isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-full",
                className
            )}
            {...props}
        >
            {getIcon()}
            <div className="flex-1 min-w-0">
                {title && (
                    <div className="font-medium text-sm text-gray-900 mb-1">
                        {title}
                    </div>
                )}
                <div className="text-sm text-gray-700">
                    {message}
                </div>
            </div>
            <button
                onClick={() => {
                    setIsVisible(false)
                    setTimeout(() => onClose?.(), 150)
                }}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close notification"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    )
})

Toast.displayName = "Toast"

export { Toast }
