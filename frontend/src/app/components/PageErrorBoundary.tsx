import { Component, type ReactNode } from 'react';

export class PageErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" className="mx-auto max-w-xl px-6 py-32 text-center">
      <h1 className="text-2xl font-semibold">This page could not load</h1>
      <p className="mt-3 text-muted-foreground">Reload the page to try again. Your saved work is kept on the server.</p>
      <button onClick={() => window.location.reload()} className="mt-6 rounded-lg bg-primary px-5 py-3 text-primary-foreground">Reload page</button>
      <a href="/dashboard" className="ml-5 text-primary underline">Return to dashboard</a>
    </section>;
  }
}
