import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, FileQuestion, ListChecks, Users, Percent, Target, ArrowLeft } from 'lucide-react';
import api from '../../../lib/aptitudeApi';
import { Card } from '../../../app/components/ui/card';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/api/admin/aptitude/dashboard')
      .then(({ data }) => setStats(data))
      .catch((err) => setError(err?.response?.data?.message || err.message || 'Failed to load dashboard.'));
  }, []);

  const cards = stats
    ? [
        { label: 'Total Students', value: stats.totalStudents, icon: Users },
        { label: 'Total Questions', value: stats.totalQuestions, icon: FileQuestion },
        { label: 'Total Tests', value: stats.totalTests, icon: ListChecks },
        { label: 'Total Attempts', value: stats.totalAttempts, icon: ClipboardList },
        { label: 'Avg Score', value: `${stats.averageScorePercent}%`, icon: Target },
        { label: 'Avg Accuracy', value: `${stats.averageAccuracy}%`, icon: Percent },
      ]
    : [];

  const quickLinks = [
    { label: 'Question Bank', to: '/admin/aptitude/questions' },
    { label: 'Test Management', to: '/admin/aptitude/tests' },
    { label: 'Students', to: '/admin/aptitude/students' },
  ];

  return (
    <div className="min-h-screen bg-background px-4 py-20 text-foreground">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <Link to="/admin" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin Dashboard
          </Link>
          <h1 className="text-4xl gradient-text mb-2">Aptitude Platform Overview</h1>
          <p className="text-muted-foreground">Question bank, tests, and student performance for the aptitude module</p>
        </div>

        <div className="flex flex-wrap gap-3">
          {quickLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-lg border border-border bg-secondary/50 px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {error && (
          <Card className="p-6">
            <p className="text-destructive">{error}</p>
          </Card>
        )}

        {!stats && !error && <p className="text-muted-foreground">Loading…</p>}

        {stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {cards.map((c) => (
              <Card key={c.label} className="p-6">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/70 rounded-xl flex items-center justify-center mb-4">
                  <c.icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-2xl gradient-text mb-1">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}