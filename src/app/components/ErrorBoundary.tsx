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

  /**
   * Go home, and mean it.
   *
   * A page that failed to load its own code is usually a browser holding an app
   * shell from a previous release: it asks for chunk filenames the server no
   * longer has, and navigating within that shell fails the same way. So for that
   * error the cached shell and its service worker are thrown away first, and the
   * reload that follows starts from whatever is deployed now.
   */
  private handleReset = async (): Promise<void> => {
    if (/dynamically imported module|Importing a module script failed/i.test(this.state.message)) {
      try {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        }
        const registrations = await navigator.serviceWorker?.getRegistrations?.() ?? [];
        await Promise.all(registrations.map(registration => registration.unregister()));
      } catch {
        // Nothing to clear, or the browser refused — reload anyway.
      }
    }
    this.setState({ hasError: false, message: '' });
    window.location.replace('/');
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
          onClick={() => { void this.handleReset(); }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold"
        >
          <RotateCcw className="w-4 h-4" />
          Back to Home
        </button>
      </div>
    );
  }
}
