import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          backgroundColor: '#fee',
          border: '2px solid #f00',
          borderRadius: '5px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#c00', marginBottom: '10px' }}>
            Something went wrong!
          </h2>
          <details style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
            <summary>Error Details</summary>
            <p><strong>Error:</strong> {this.state.error && this.state.error.toString()}</p>
            <p><strong>Stack:</strong> {this.state.error && this.state.error.stack}</p>
            {this.state.errorInfo && (
              <p><strong>Component Stack:</strong> {this.state.errorInfo.componentStack}</p>
            )}
          </details>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
