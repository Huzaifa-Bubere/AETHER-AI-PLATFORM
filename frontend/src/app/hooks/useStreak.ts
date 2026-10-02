import { useCallback, useEffect, useState } from 'react';
import { fetchStreak, StreakSummary } from '../services/activity';

/**
 * Loads the AETHER streak once and shares it between every surface that shows
 * it, so the dashboard hero and the profile can never render two different
 * current-streak numbers for the same user.
 */
export function useStreak(roleId?: string) {
  const [streak, setStreak] = useState<StreakSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStreak(await fetchStreak(roleId ? { roleId } : {}));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your streak.');
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { streak, loading, error, reload: load };
}
