import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

/**
 * Catches a render crash so it doesn't take the whole screen with it.
 *
 * React unmounts the entire tree when a render throws and nothing catches it,
 * which empties #root and leaves the body's gradient and nothing else — the
 * "blank purple screen" that is impossible to report usefully and impossible
 * to diagnose from a phone. This turns that into a page that says what broke.
 *
 * The child is the one who usually hits it, so the message is for them first;
 * the technical detail sits underneath for a grown-up to read out or screenshot.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep it in the console too, where a remote debugger can reach it.
    console.error("Render crash:", error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-dvh flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full flex flex-col items-center gap-4">
          <p className="text-24 text-fog-50">Something went wrong</p>
          <p className="text-16 text-fog-200">
            This screen stopped working. Nothing is lost — try again.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-11 px-6 rounded-pill bg-iris-500 text-fog-50 text-16 font-medium"
          >
            Try again
          </button>
          {/* For the grown-up: enough to screenshot and act on. */}
          <details className="w-full mt-2 text-left">
            <summary className="text-13 text-fog-400 cursor-pointer">Details for a grown-up</summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-ink-900/80 p-3 text-11 leading-relaxed text-coral-300 whitespace-pre-wrap break-words">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
              {componentStack ? `\n\nComponent stack:${componentStack}` : ""}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
