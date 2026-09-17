import { Component, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface InnerProps {
  children: ReactNode;
  /** Changing this value resets the boundary (route changes get a fresh page). */
  resetKey: string;
}

interface InnerState {
  failed: boolean;
  error: Error | null;
}

/**
 * App-wide crash guard. Auto-resets when the route changes, so a crash on one
 * page (e.g. a report) never permanently poisons navigation to other pages.
 * The functional wrapper supplies the router location (hooks can't run in a class).
 * Renders the actual error message so bugs are diagnosable from the screen.
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <BoundaryInner key={location.pathname} resetKey={location.pathname}>
      {children}
    </BoundaryInner>
  );
}

class BoundaryInner extends Component<InnerProps, InnerState> {
  state: InnerState = { failed: false, error: null };
  static getDerivedStateFromError(error: Error): InnerState {
    return { failed: true, error };
  }

  componentDidUpdate(prevProps: InnerProps) {
    // Navigating away from a crashed page clears the failure state.
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false, error: null });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section role="alert" className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">This page could not load</h1>
        <p className="mt-3 text-muted-foreground">Reload the page to try again. Your saved work is kept on the server.</p>
        {this.state.error && (
          <pre className="mt-6 mx-auto max-w-full overflow-x-auto rounded-lg bg-secondary border border-border p-4 text-left text-xs text-muted-foreground whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
        )}
        <div className="mt-6">
          <button onClick={() => window.location.reload()} className="rounded-lg bg-primary px-5 py-3 text-primary-foreground">Reload page</button>
          <a href="/dashboard" className="ml-5 text-primary underline">Return to dashboard</a>
        </div>
      </section>
    );
  }
}
