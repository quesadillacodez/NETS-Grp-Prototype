import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Something went wrong.' };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Logged for debugging; in a real deployment this would also go to an error-tracking service.
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, message: '' });
    window.location.href = '/';
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col h-full items-center justify-center bg-background px-6 text-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-destructive" />
        </div>
        <div>
          <p className="font-black text-foreground mb-1">Something went wrong</p>
          <p className="text-xs text-muted-foreground max-w-xs">{this.state.message}</p>
        </div>
        <button
          onClick={this.handleReset}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold"
        >
          <RotateCcw className="w-4 h-4" />
          Back to Home
        </button>
      </div>
    );
  }
}
