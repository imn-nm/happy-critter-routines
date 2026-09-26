import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors anywhere in the app. Without this, a crash inside a
 * page unmounts everything and leaves only the page gradient, with no clue
 * what happened. The message is shown on screen so it can be read off a
 * phone and reported.
 */
class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="min-h-dvh flex items-center justify-center px-6">
        <div className="w-full max-w-[420px] rounded-[24px] bg-focus-surface p-5 text-focus-text">
          <h1 className="text-20 font-bold mb-2">Something Went Wrong</h1>
          <p className="text-14 text-focus-muted mb-4">
            The page hit an error and stopped. Reloading usually fixes it. If it keeps happening, send the text below.
          </p>
          <pre className="text-12 whitespace-pre-wrap break-words rounded-[14px] bg-focus-sunken p-3 mb-4 text-focus-coral max-h-48 overflow-auto">
            {error.name}: {error.message}
            {error.stack ? `\n\n${error.stack.split("\n").slice(1, 4).join("\n")}` : ""}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full h-11 rounded-[14px] bg-focus-lime text-focus-bg text-14 font-semibold"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
