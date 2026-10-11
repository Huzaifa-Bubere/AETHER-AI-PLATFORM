import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface InnerProps {
  children: ReactNode;
  /** Changing this value resets the boundary (route changes get a fresh page). */
  resetKey: string;
}

interface InnerState {
  failed: boolean;
  error: Error | null;
  errorId: string | null;
  componentStack: string | null;
}

/**
 * App-wide crash guard (spec §14). Auto-resets when the route changes, so a crash
 * on one page (e.g. a report) never permanently poisons navigation to other pages.
 * The functional wrapper supplies the router location (hooks can't run in a class).
 *
 * This is the LAST line of defence: malformed optional data is normalized at the
 * API boundary, so a missing array should never reach this boundary. When a real
 * crash happens, development shows the error id, route, message and component
 * stack; production shows only the friendly message plus the error id.
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <BoundaryInner key={location.pathname} resetKey={location.pathname}>
      {children}
    </BoundaryInner>
  );
}

function makeErrorId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 36 ** 3).toString(36).toUpperCase().padStart(3, '0');
  return `AETH-${stamp}-${rand}`;
}

class BoundaryInner extends Component<InnerProps, InnerState> {
  state: InnerState = { failed: false, error: null, errorId: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<InnerState> {
    return { failed: true, error, errorId: makeErrorId() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Diagnostics are always logged (useful in the browser console / log drain),
    // but only the development UI renders them.
    this.setState({ componentStack: info.componentStack ?? null });
    // eslint-disable-next-line no-console
    console.error(
      `[AETHER] Unhandled UI error ${this.state.errorId} on route ${this.props.resetKey}`,
      error,
      info.componentStack,
    );
  }

  componentDidUpdate(prevProps: InnerProps) {
    // Navigating away from a crashed page clears the failure state.
    if (prevProps.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false, error: null, errorId: null, componentStack: null });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { error, errorId, componentStack } = this.state;
    return (
      <section role="alert" className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">This page could not load</h1>
        <p className="mt-3 text-muted-foreground">Reload the page to try again. Your saved work is kept on the server.</p>
        {errorId && (
          <p className="mt-2 text-xs text-muted-foreground">
            Reference <span className="font-mono font-semibold">{errorId}</span>
          </p>
        )}
        {import.meta.env.DEV && error && (
          <div className="mt-6 space-y-3 text-left">
            <p className="text-xs text-muted-foreground">
              Route <span className="font-mono">{this.props.resetKey}</span>
            </p>
            <pre className="mx-auto max-w-full overflow-x-auto rounded-lg bg-secondary border border-border p-4 text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {error.message}
              {componentStack ? `\n\nComponent stack:${componentStack}` : ''}
            </pre>
          </div>
        )}
        <div className="mt-6">
          <button onClick={() => window.location.reload()} className="rounded-lg bg-primary px-5 py-3 text-primary-foreground">
            Reload page
          </button>
          <a href="/dashboard" className="ml-5 text-primary underline">Return to dashboard</a>
        </div>
      </section>
    );
  }
}
