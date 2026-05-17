import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; name?: string; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[ErrorBoundary: ${this.props.name ?? "unknown"}]`, error);
    console.error("Component stack:", info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 gap-4">
          <div className="w-full max-w-xl rounded-xl border border-red-500/20 bg-red-500/5 p-6">
            <h2 className="text-sm font-semibold text-red-500 mb-2">
              {this.props.name ? `Error in ${this.props.name}` : "Render Error"}
            </h2>
            <p className="text-xs font-mono text-red-400 mb-3 leading-relaxed">
              {this.state.error.message}
            </p>
            <pre className="text-[10px] text-muted-foreground overflow-auto max-h-48 bg-muted p-3 rounded-md">
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 px-3 py-1.5 text-xs rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-fast"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
