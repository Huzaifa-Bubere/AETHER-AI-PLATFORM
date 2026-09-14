import { Link } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import api from '../../../lib/aptitudeApi';


interface StudentRow {
  userId: string;
  name: string;
  email: string;
  isBlocked: boolean;
  attempts: number;
  avgScorePercent: number;
  lastAttemptAt: string;
}

export default function StudentManager() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const requestId = useRef(0);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = async () => {
    const current = ++requestId.current;
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/aptitude/students', { params: { search } });
      if (current !== requestId.current) return;
      setStudents(data.students);
      setError(null);
    } catch (error: any) {
      if (current === requestId.current) setError(error?.response?.data?.message || error?.response?.data?.error || 'Could not load students. Please retry.');
    } finally { if (current === requestId.current) setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(fetchStudents, 300); // debounce search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleBlock = async (userId: string, isBlocked: boolean) => {
    if (updating) return;
    setUpdating(userId);
    try {
      await api.patch(`/api/admin/aptitude/students/${userId}/block`, { isBlocked: !isBlocked });
      await fetchStudents();
    } catch (error: any) {
      setError(error?.response?.data?.message || 'Could not update the student. Please retry.');
    } finally { setUpdating(null); }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-20 text-foreground">
      {error && <p role="alert" className="my-4 text-destructive">{error}</p>}
      <Link to="/admin/aptitude" className="mb-4 inline-block text-sm text-primary">Back to Aptitude Admin</Link>
      <div className="mb-6 flex flex-wrap gap-3 items-center justify-between">
        <h1 className="text-xl font-bold">Students</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-64 rounded-md bg-secondary px-3 py-2 text-sm"
        />
      </div>

      <p className="mb-4 text-sm text-muted-foreground">Blocking prevents this student from signing in across the platform. Unblocked students can sign in again.</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-muted-foreground">
            <tr>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Email</th>
              <th className="p-3 text-left">Attempts</th>
              <th className="p-3 text-left">Avg Score</th>
              <th className="p-3 text-left">Last Attempt</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.userId} className="border-t border-border">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 text-muted-foreground">{s.email}</td>
                <td className="p-3">{s.attempts}</td>
                <td className="p-3">{s.avgScorePercent}%</td>
                <td className="p-3 text-muted-foreground">{new Date(s.lastAttemptAt).toLocaleDateString()}</td>
                <td className="p-3">
                  <span className={s.isBlocked ? 'text-destructive' : 'text-emerald-700'}>{s.isBlocked ? 'Blocked' : 'Active'}</span>
                </td>
                <td className="p-3">
                  <button disabled={!!updating} onClick={() => toggleBlock(s.userId, s.isBlocked)} className="text-primary hover:underline">
                    {s.isBlocked ? 'Unblock' : 'Block'}
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  {loading ? 'Loading students...' : 'No students with completed attempts found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
