/**
 * AETHER wordmark. Inline SVG so it stays crisp, themeable and adds no network
 * request (spec §57 — prefer real/CSS/SVG brand visual over stock imagery).
 */
export function Logo({ className = '', showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        role="img"
        aria-label="AETHER"
        className="h-7 w-7 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="aether-mark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="55%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#aether-mark)" />
        {/* stylised 'A' / neural node triad */}
        <path d="M10 23L16 9l6 14" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.6 18.6h6.8" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" opacity="0.85" />
        <circle cx="16" cy="9" r="2.1" fill="#fff" />
      </svg>
      {showWordmark && (
        <span className="text-[15px] font-black tracking-[0.16em] text-slate-900">AETHER</span>
      )}
    </span>
  );
}