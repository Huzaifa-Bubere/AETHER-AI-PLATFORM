import { PaletteStatus } from '../../store/aptitudeStore';

interface PaletteProps {
  total: number;
  currentIndex: number;
  statuses: PaletteStatus[];
  onNavigate: (index: number) => void;
}

const STATUS_STYLES: Record<PaletteStatus, string> = {
  'not-visited': 'bg-neutral-700 text-neutral-300',
  'not-answered': 'bg-red-600 text-white',
  answered: 'bg-emerald-600 text-white',
  'marked-for-review': 'bg-violet-600 text-white',
  'answered-marked-for-review': 'bg-violet-600 text-white ring-2 ring-emerald-400',
};

const LEGEND: { status: PaletteStatus; label: string }[] = [
  { status: 'not-visited', label: 'Not Visited' },
  { status: 'not-answered', label: 'Not Answered' },
  { status: 'answered', label: 'Answered' },
  { status: 'marked-for-review', label: 'Marked for Review' },
  { status: 'answered-marked-for-review', label: 'Answered & Marked' },
];

export default function QuestionPalette({ total, currentIndex, statuses, onNavigate }: PaletteProps) {
  const answered = statuses.filter((s) => s === 'answered' || s === 'answered-marked-for-review').length;

  return (
    <aside className="w-64 shrink-0 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center justify-between text-sm text-neutral-400">
        <span>Answered: <span className="text-emerald-400 font-semibold">{answered}</span></span>
        <span>Remaining: <span className="text-red-400 font-semibold">{total - answered}</span></span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => onNavigate(i)}
            aria-current={i === currentIndex}
            className={`h-9 w-9 rounded-md text-sm font-medium transition-transform hover:scale-105 ${STATUS_STYLES[statuses[i]]} ${
              i === currentIndex ? 'outline outline-2 outline-offset-2 outline-blue-400' : ''
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-1.5 border-t border-neutral-800 pt-3">
        {LEGEND.map((l) => (
          <div key={l.status} className="flex items-center gap-2 text-xs text-neutral-400">
            <span className={`h-3 w-3 rounded-sm ${STATUS_STYLES[l.status]}`} />
            {l.label}
          </div>
        ))}
      </div>
    </aside>
  );
}
