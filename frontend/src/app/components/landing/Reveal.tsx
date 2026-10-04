import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * Scroll reveal used across the marketing page.
 * Respects prefers-reduced-motion by rendering statically (spec §26/§53).
 * Uses transform/opacity only so it never triggers layout thrash.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li';
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduce) { setShown(true); return; }
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return; }
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduce]);

  const MotionTag = motion[Tag] as typeof motion.div;

  return (
    <MotionTag
      ref={ref as never}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </MotionTag>
  );
}

/** Consistent section heading + optional lede (spec §6). */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = 'center',
  className = '',
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  const alignment = align === 'center' ? 'mx-auto text-center max-w-3xl' : 'max-w-2xl';
  return (
    <Reveal className={`${alignment} ${className}`}>
      {eyebrow && (
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-indigo-500">{eyebrow}</p>
      )}
      <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {lede && <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{lede}</p>}
    </Reveal>
  );
}

/** Small pill used to mark illustrative/demo data honestly (spec §30/§37). */
export function ExampleTag({ children = 'Example Candidate View', className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 ${className}`}
    >
      {children}
    </span>
  );
}