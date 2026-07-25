import { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

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

  const fetchStudents = async () => {
    const { data } = await api.get('/api/admin/aptitude/students', { params: { search } });
    setStudents(data.students);
  };

  useEffect(() => {
    const t = setTimeout(fetchStudents, 300); // debounce search
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleBlock = async (userId: string, isBlocked: boolean) => {
    await api.patch(`/api/admin/aptitude/students/${userId}/block`, { isBlocked: !isBlocked });
    fetchStudents();
  };

  return (
    <div className="text-neutral-100">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Students</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-64 rounded-md bg-neutral-800 px-3 py-2 text-sm"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-neutral-400">
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
              <tr key={s.userId} className="border-t border-neutral-800">
                <td className="p-3 font-medium">{s.name}</td>
                <td className="p-3 text-neutral-400">{s.email}</td>
                <td className="p-3">{s.attempts}</td>
                <td className="p-3">{s.avgScorePercent}%</td>
                <td className="p-3 text-neutral-400">{new Date(s.lastAttemptAt).toLocaleDateString()}</td>
                <td className="p-3">
                  <span className={s.isBlocked ? 'text-red-400' : 'text-emerald-400'}>{s.isBlocked ? 'Blocked' : 'Active'}</span>
                </td>
                <td className="p-3">
                  <button onClick={() => toggleBlock(s.userId, s.isBlocked)} className="text-blue-400 hover:underline">
                    {s.isBlocked ? 'Unblock' : 'Block'}
                  </button>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-neutral-500">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
