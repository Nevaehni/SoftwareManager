import * as React from "react"
import { Toast, ToastProps } from "./toast"

export interface ToastContainerProps {
    toasts: ToastProps[]
    onRemoveToast: (id: string) => void
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemoveToast }) => {
    if (toasts.length === 0) return null

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
            {toasts.map((toast) => (
                <Toast
                    key={toast.id}
                    {...toast}
                    onClose={() => onRemoveToast(toast.id)}
                />
            ))}
        </div>
    )
}

export const useToast = () => {
    const [toasts, setToasts] = React.useState<ToastProps[]>([])

    const addToast = React.useCallback((toast: Omit<ToastProps, 'id'>) => {
        const id = Math.random().toString(36).substr(2, 9)
        const newToast: ToastProps = { ...toast, id }

        setToasts(prev => [...prev, newToast])
    }, [])

    const removeToast = React.useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id))
    }, [])

    const showSuccess = React.useCallback((message: string, title?: string) => {
        addToast({ type: 'success', message, title })
    }, [addToast])

    const showError = React.useCallback((message: string, title?: string) => {
        addToast({ type: 'error', message, title })
    }, [addToast])

    const showWarning = React.useCallback((message: string, title?: string) => {
        addToast({ type: 'warning', message, title })
    }, [addToast])

    const showInfo = React.useCallback((message: string, title?: string) => {
        addToast({ type: 'info', message, title })
    }, [addToast])

    return {
        toasts,
        addToast,
        removeToast,
        showSuccess,
        showError,
        showWarning,
        showInfo
    }
}
