import { Link, useLocation } from 'react-router-dom';
import { CANDIDATE_HOME, MARKETING_HOME, candidateNavigation } from '../components/navigation';
import { useAuthStore } from '../stores/authStore';

/**
 * Spec §3/§26: an unknown URL must land on a real 404 page, not silently bounce
 * to `/`. Silently redirecting hides broken links and makes route testing lie.
 */
export function NotFoundPage() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const home = isAuthenticated ? CANDIDATE_HOME : MARKETING_HOME;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p>
          <h1 className="text-3xl font-bold sm:text-4xl">This page does not exist</h1>
          <p className="text-muted-foreground">
            Nothing is served at{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">
              {location.pathname}
            </code>
            . It may have been renamed.
          </p>
        </div>

        {isAuthenticated && (
          <div className="space-y-3 text-left">
            <p className="text-sm font-medium text-muted-foreground">Go to one of these instead:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {candidateNavigation.slice(0, 8).map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <Link
          to={home}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {isAuthenticated ? 'Back to dashboard' : 'Go to AETHER'}
        </Link>
      </div>
    </div>
  );
}
