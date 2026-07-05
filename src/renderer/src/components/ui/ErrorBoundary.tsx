import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
          <AlertTriangle size={32} className="text-red-400" />
          <div>
            <p className="text-sm font-semibold text-gray-200">Something went wrong</p>
            <p className="text-xs text-gray-500 mt-1">{this.state.error.message}</p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
