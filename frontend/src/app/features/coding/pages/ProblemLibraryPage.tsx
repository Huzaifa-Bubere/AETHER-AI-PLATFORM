import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ChevronLeft, ChevronRight, Circle, CircleCheck, CircleDot, Loader2 } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { codingService } from '../services/coding.service';
import type { CodingProblem } from '../types';

const CATEGORIES = [
  'all', 'Arrays', 'Strings', 'Linked Lists', 'Stacks', 'Queues', 'Hashing',
  'Binary Search', 'Sorting', 'Recursion', 'Backtracking', 'Trees', 'Heaps',
  'Graphs', 'Greedy', 'Dynamic Programming', 'Sliding Window', 'Two Pointers',
  'Bit Manipulation', 'Math', 'Prefix Sum', 'Tries',
];

/**
 * AETHER Coding — problem library.
 */
export function ProblemLibraryPage() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<CodingProblem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [difficulty, setDifficulty] = useState('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchProblems = useCallback(async (p: number) => {
    setLoading(true);
    const res = await codingService.listProblems({
      page: p, limit: 20, difficulty, category, status,
      search: search || undefined,
    });
    if (res.success && res.data) {
      setProblems(res.data.problems);
      setTotalPages(res.data.pagination.totalPages || 1);
      setPage(p);
    }
    setLoading(false);
  }, [difficulty, category, status, search]);

  useEffect(() => {
    void fetchProblems(1);
  }, [difficulty, category, status, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusIcon = (s?: { solved: boolean; attempted: boolean }) => {
    if (s?.solved) return <CircleCheck className="w-4 h-4 text-emerald-500" aria-label="Solved" />;
    if (s?.attempted) return <CircleDot className="w-4 h-4 text-amber-500" aria-label="Attempted" />;
    return <Circle className="w-4 h-4 text-slate-300" aria-label="Unsolved" />;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Problem Library</h1>
            <p className="text-sm text-slate-500">Curated DSA problems with AST-driven evaluation</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/coding')}>
            <ChevronLeft className="w-4 h-4" /> Coding Dashboard
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput); }}
                placeholder="Search problems… (press Enter)"
                aria-label="Search problems"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status"
              className="text-sm border rounded-lg px-2.5 py-2 bg-white">
              <option value="all">All</option>
              <option value="solved">Solved</option>
              <option value="attempted">Attempted</option>
              <option value="unsolved">Unsolved</option>
            </select>
          </div>
          <div className="flex gap-2">
            {['all', 'Easy', 'Medium', 'Hard'].map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  difficulty === d ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                {d === 'all' ? 'All Levels' : d}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  category === c ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
                {c === 'all' ? 'All Topics' : c}
              </button>
            ))}
          </div>
        </Card>

        {/* List */}
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : problems.length === 0 ? (
          <Card className="p-10 text-center text-sm text-slate-400">No problems match your filters.</Card>
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {problems.map(p => (
              <Link key={p._id} to={`/coding/problems/${p.slug}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                {statusIcon(p.status)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{p.title}</p>
                  <p className="text-xs text-slate-400">{p.category}{p.tags?.slice(0, 3).map(t => ` · ${t}`)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  p.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-700'
                  : p.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700'
                  : 'bg-rose-100 text-rose-700'}`}>
                  {p.difficulty}
                </span>
              </Link>
            ))}
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => fetchProblems(page - 1)}>
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => fetchProblems(page + 1)}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
