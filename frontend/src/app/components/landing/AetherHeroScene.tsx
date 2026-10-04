import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';

/**
 * AETHER Career Intelligence Core — hero 3D (spec §18–§27).
 *
 * Performance contract:
 *  - Canvas is `dpr={[1, 1.5]}` — never force 2x (§23)
 *  - one shared sphere geometry + two shared materials, no textures, no shadows,
 *    no post-processing (§23)
 *  - animation pauses when the canvas is offscreen or `document.hidden` (§24)
 *  - reduced motion freezes rotation and renders a static frame (§26)
 *  - low-power devices get a simplified scene; the CSS fallback covers no-WebGL (§25)
 *
 * The scene is decorative: all messaging lives in the hero copy, so the page is
 * fully understandable without it (§59).
 */

const NODES = [
  { label: 'CODING', detail: 'AST + Correctness + Complexity', pos: [0, 2.15, 0] },
  { label: 'INTERVIEW', detail: 'Technical + Communication Evidence', pos: [2.0, 0.75, 0.4] },
  { label: 'RESUME', detail: 'ATS + Job Match', pos: [1.25, -1.75, 0.35] },
  { label: 'LEARNING', detail: 'Role-Based Skill Development', pos: [-1.25, -1.75, 0.35] },
  { label: 'CAREER', detail: 'Readiness + Skill Intelligence', pos: [-2.0, 0.75, 0.4] },
  { label: 'JOBS', detail: 'Role & Job Compatibility', pos: [0, 0, -2.05] },
] as const;

/** Cheap capability probe — returns false on very weak devices. */
function isLowPower(): boolean {
  if (typeof navigator === 'undefined') return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const cores = navigator.hardwareConcurrency ?? 8;
  const coarse =
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  return coarse || (typeof mem === 'number' && mem <= 4) || cores <= 4;
}

function webglAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function Core({ reduce, active, simple }: { reduce: boolean; active: boolean; simple: boolean }) {
  const core = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const sphereGeo = useRef<THREE.SphereGeometry | null>(null);
  const sphereMat = useRef<THREE.MeshStandardMaterial | null>(null);

  // Reuse ONE geometry + material instance across every mesh (§23).
  if (!sphereGeo.current) sphereGeo.current = new THREE.SphereGeometry(1, 24, 24);
  if (!sphereMat.current) {
    sphereMat.current = new THREE.MeshStandardMaterial({
      color: '#4F46E5',
      emissive: '#2563EB',
      emissiveIntensity: 0.85,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.92,
    });
  }

  useFrame((state, delta) => {
    if (!active || reduce) return;
    const d = Math.min(delta, 0.05);
    if (core.current) core.current.rotation.y += d * 0.18;
    if (ringA.current) ringA.current.rotation.z += d * 0.12;
    if (ringB.current) ringB.current.rotation.x -= d * 0.09;
    // Very subtle pointer parallax only — never a chase (§21).
    const p = state.pointer;
    if (core.current) {
      core.current.position.x += (p.x * 0.08 - core.current.position.x) * 0.02;
      core.current.position.y += (p.y * 0.06 - core.current.position.y) * 0.02;
    }
  });

  return (
    <group>
      <mesh ref={core} geometry={sphereGeo.current} material={sphereMat.current} scale={0.95} />

      {/* thin orbital rings */}
      <mesh ref={ringA} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.65, 0.008, 6, 64]} />
        <meshBasicMaterial color="#6366F1" transparent opacity={0.5} />
      </mesh>
      <mesh ref={ringB} rotation={[0, Math.PI / 3, Math.PI / 5]}>
        <torusGeometry args={[2.05, 0.006, 6, 64]} />
        <meshBasicMaterial color="#7C3AED" transparent opacity={0.35} />
      </mesh>

      {/* concept nodes — smaller set + fewer particles on low-power (§25) */}
      {NODES.map((n, i) => (
        <ConceptNode key={n.label} {...n} index={i} simple={simple} reduce={reduce} />
      ))}

      {/* sparse particles only (never a storm, §28) */}
      {!simple && (
        <points>
          <bufferGeometry>
            <sphereGeometry args={[2.9, 16, 12]} />
          </bufferGeometry>
          <pointsMaterial size={0.02} color="#93C5FD" transparent opacity={0.55} sizeAttenuation />
        </points>
      )}

      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 3, 4]} intensity={0.6} color="#C7D2FE" />
    </group>
  );
}

function ConceptNode({
  label,
  detail,
  pos,
  index,
  simple,
  reduce,
}: {
  label: string;
  detail: string;
  pos: readonly number[];
  index: number;
  simple: boolean;
  reduce: boolean;
}) {
  const [hover, setHover] = useState(false);
  const grp = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (!grp.current) return;
    if (reduce) return;
    // gentle float — slow, small, non-nauseating (§21)
    const t = state.clock.elapsedTime * 0.6 + index * 1.1;
    const targetY = pos[1] + Math.sin(t) * 0.06;
    grp.current.position.set(pos[0], targetY, pos[2]);
  });

  const scale = hover ? 1.28 : 1;

  return (
    <group ref={grp} position={pos as unknown as [number, number, number]}>
      {/* connection line toward the core */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([0, 0, 0, -pos[0], -pos[1], -pos[2]])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={hover ? '#4F46E5' : '#94A3B8'} transparent opacity={hover ? 0.9 : 0.35} />
      </line>

      <mesh
        scale={scale}
        onPointerOver={e => { e.stopPropagation(); setHover(true); }}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={hover ? '#4F46E5' : '#93C5FD'}
          emissive={hover ? '#4F46E5' : '#1D4ED8'}
          emissiveIntensity={hover ? 0.9 : 0.4}
        />
      </mesh>

      {!simple && (
        <Html center distanceFactor={7} style={{ pointerEvents: 'none' }}>
          <span
            className={`whitespace-nowrap rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider transition-colors ${
              hover
                ? 'border-indigo-300 bg-white text-indigo-700 shadow-sm'
                : 'border-slate-200 bg-white/90 text-slate-500'
            }`}
          >
            {label}
          </span>
        </Html>
      )}

      {hover && !simple && (
        <Html center distanceFactor={9} position={[0, -0.42, 0]} style={{ pointerEvents: 'none' }}>
          <span className="block max-w-[190px] whitespace-normal rounded-md bg-slate-900 px-2 py-1 text-center text-[9.5px] leading-snug text-white shadow-lg">
            {detail}
          </span>
        </Html>
      )}
    </group>
  );
}

/** CSS-only AETHER orb — shown when WebGL is unavailable or on low-power (§27). */
function StaticOrb() {
  return (
    <div className="relative flex h-full w-full items-center justify-center" aria-hidden="true">
      <div className="absolute h-56 w-56 rounded-full bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-violet-500/20 blur-2xl" />
      <div className="relative flex h-40 w-40 items-center justify-center rounded-full border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 shadow-[0_18px_50px_-20px_rgba(79,70,229,0.45)]">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-violet-600 shadow-inner">
          <span className="text-[11px] font-black tracking-[0.18em] text-white">AETHER</span>
        </div>
      </div>
      <div className="absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-indigo-200 to-transparent" />
    </div>
  );
}

export default function AetherHeroScene({ className = '' }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const reduce = useReducedMotion();

  // Delay the WebGL bundle until after first paint so headline/CTA render first (§22/§56).
  useEffect(() => {
    const r = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(r);
  }, []);

  // Pause when offscreen or the tab is hidden (§24).
  useEffect(() => {
    const el = document.getElementById('aether-hero-canvas');
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    const onVis = () => setVisible(!document.hidden && io.takeRecords().every(r => r.isIntersecting || true));
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [mounted]);

  const lowPower = isLowPower();
  const noWebgl = typeof window !== 'undefined' && !webglAvailable();

  if (!mounted || reduce || noWebgl || lowPower) {
    return (
      <div className={className}>
        <StaticOrb />
      </div>
    );
  }

  return (
    <div id="aether-hero-canvas" className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        camera={{ position: [0, 0, 6], fov: 42 }}
      >
        <Suspense fallback={null}>
          <Core reduce={!!reduce} active={visible} simple={lowPower} />
        </Suspense>
      </Canvas>
    </div>
  );
}