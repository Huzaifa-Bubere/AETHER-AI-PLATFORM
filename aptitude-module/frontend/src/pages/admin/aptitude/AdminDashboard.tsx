import { useEffect, useState } from 'react';
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

interface Stats {
  totalStudents: number;
  totalQuestions: number;
  totalTests: number;
  totalAttempts: number;
  averageScorePercent: number;
  averageAccuracy: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get('/api/admin/aptitude/dashboard').then(({ data }) => setStats(data));
  }, []);

  const cards = stats
    ? [
        { label: 'Total Students', value: stats.totalStudents },
        { label: 'Total Questions', value: stats.totalQuestions },
        { label: 'Total Tests', value: stats.totalTests },
        { label: 'Total Attempts', value: stats.totalAttempts },
        { label: 'Avg Score', value: `${stats.averageScorePercent}%` },
        { label: 'Avg Accuracy', value: `${stats.averageAccuracy}%` },
      ]
    : [];

  return (
    <div className="text-neutral-100">
      <h1 className="mb-6 text-xl font-bold">Aptitude Platform Overview</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <p className="text-2xl font-bold">{c.value}</p>
            <p className="mt-1 text-xs text-neutral-500">{c.label}</p>
          </div>
        ))}
        {!stats && <p className="text-neutral-500">Loading…</p>}
      </div>
    </div>
  );
}
