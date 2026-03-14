"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

/* ─── Types (mirrors taktik/page.tsx) ───────────────────────── */
interface Player {
  id: string;
  /** Legacy format (old tactic board) */
  type?: "O" | "X";
  /** New format (current tactic board) — mutually exclusive with `type` */
  team?: "home" | "away" | "ball";
  number?: number;
  name?: string;
  x: number;
  y: number;
}

interface Arrow {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type DrawingType = "arrow" | "dashed" | "circle" | "rect" | "zone";

interface Drawing {
  id: string;
  type: DrawingType;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface LiveState {
  teamId: string;
  players: Player[];
  arrows?: Arrow[];
  drawings?: Drawing[];
  steps?: unknown[];
  animationPlaying: boolean;
  animationStartTime: string | null;
}

/* ─── Court dimensions ────────────────────────────────────────── */
const W = 380;
const H = 510;
const SOURCE_W = 760;
const SOURCE_H = 460;
const ANIMATION_DURATION = 1600;

/* ─── Animation helpers ──────────────────────────────────────── */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function buildArrowPlayerMap(
  arrows: Arrow[],
  players: Player[]
): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const arrow of arrows) {
    let minDist = 55;
    let nearest: Player | null = null;
    for (const p of players) {
      if (used.has(p.id)) continue;
      const dx = p.x - arrow.x1;
      const dy = p.y - arrow.y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    if (nearest) {
      map.set(arrow.id, nearest.id);
      used.add(nearest.id);
    }
  }
  return map;
}

/* ─── SVG sub-components ────────────────────────────────────── */
function ArrowMarker() {
  return (
    <defs>
      <marker
        id="arrowhead"
        markerWidth="8"
        markerHeight="6"
        refX="7"
        refY="3"
        orient="auto"
      >
        <polygon points="0 0, 8 3, 0 6" fill="#facc15" />
      </marker>
    </defs>
  );
}

function DrawingMarkers() {
  return (
    <defs>
      <marker id="cast-ah-y" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#facc15" />
      </marker>
      <marker id="cast-ah-g" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#a3e635" />
      </marker>
    </defs>
  );
}

function BasketballCourt() {
  const lp = { stroke: "rgba(255,255,255,0.85)", strokeWidth: 2, fill: "none" };
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill="#c87428" />
      <rect x={10} y={10} width={360} height={490} {...lp} />
      <line x1={10} y1={255} x2={370} y2={255} {...lp} />
      <circle cx={190} cy={255} r={42} {...lp} />
      <circle cx={190} cy={255} r={3} fill="rgba(255,255,255,0.85)" />
      {/* Top basket */}
      <rect x={110} y={10} width={160} height={165} {...lp} fill="rgba(255,255,255,0.08)" />
      <line x1={110} y1={175} x2={270} y2={175} {...lp} />
      <path d="M 110 175 A 80 80 0 0 0 270 175" {...lp} />
      <path d="M 165 10 A 40 40 0 0 0 215 10" {...lp} />
      <line x1={155} y1={32} x2={225} y2={32} stroke="rgba(255,255,255,0.85)" strokeWidth={3} />
      <circle cx={190} cy={45} r={14} {...lp} />
      <path d="M 15 150 A 185 185 0 0 1 365 150" {...lp} />
      <line x1={15} y1={10} x2={15} y2={150} {...lp} />
      <line x1={365} y1={10} x2={365} y2={150} {...lp} />
      {/* Bottom basket */}
      <rect x={110} y={335} width={160} height={165} {...lp} fill="rgba(255,255,255,0.08)" />
      <line x1={110} y1={335} x2={270} y2={335} {...lp} />
      <path d="M 110 335 A 80 80 0 0 1 270 335" {...lp} />
      <path d="M 165 500 A 40 40 0 0 1 215 500" {...lp} />
      <line x1={155} y1={478} x2={225} y2={478} stroke="rgba(255,255,255,0.85)" strokeWidth={3} />
      <circle cx={190} cy={465} r={14} {...lp} />
      <path d="M 365 360 A 185 185 0 0 1 15 360" {...lp} />
      <line x1={15} y1={500} x2={15} y2={360} {...lp} />
      <line x1={365} y1={500} x2={365} y2={360} {...lp} />
    </g>
  );
}

/* ─── Inner board (needs Suspense for useSearchParams) ───────── */
function CastBoard() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get("team");
  const teamName = searchParams.get("name") ?? "";

  const [players, setPlayers] = useState<Player[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [animPos, setAnimPos] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const [isAnimating, setIsAnimating] = useState(false);
  const [connected, setConnected] = useState(false);

  const animFrameRef = useRef<number>(0);

  /* ─── Animation engine (same logic as taktik/page.tsx) ─────── */
  const startAnimationAt = useCallback(
    (offsetMs: number, sourcePlayers: Player[], sourceArrows: Arrow[]) => {
      cancelAnimationFrame(animFrameRef.current);

      const arrowPlayerMap = buildArrowPlayerMap(sourceArrows, sourcePlayers);
      if (arrowPlayerMap.size === 0) return;

      /* If animation already finished, settle players immediately */
      if (offsetMs >= ANIMATION_DURATION) {
        setPlayers(
          sourcePlayers.map((p) => {
            const arrowId = [...arrowPlayerMap.entries()].find(
              ([, pid]) => pid === p.id
            )?.[0];
            if (!arrowId) return p;
            const arrow = sourceArrows.find((a) => a.id === arrowId);
            return arrow ? { ...p, x: arrow.x2, y: arrow.y2 } : p;
          })
        );
        return;
      }

      const startTime = performance.now() - offsetMs;
      setIsAnimating(true);

      const tick = (now: number) => {
        const raw = Math.min((now - startTime) / ANIMATION_DURATION, 1);
        const t = easeInOut(raw);

        const newPos = new Map<string, { x: number; y: number }>();
        for (const [arrowId, playerId] of arrowPlayerMap) {
          const arrow = sourceArrows.find((a) => a.id === arrowId);
          if (!arrow) continue;
          newPos.set(playerId, {
            x: arrow.x1 + (arrow.x2 - arrow.x1) * t,
            y: arrow.y1 + (arrow.y2 - arrow.y1) * t,
          });
        }
        setAnimPos(newPos);

        if (raw < 1) {
          animFrameRef.current = requestAnimationFrame(tick);
        } else {
          setPlayers((prev) =>
            prev.map((p) => {
              const pos = newPos.get(p.id);
              return pos ? { ...p, x: pos.x, y: pos.y } : p;
            })
          );
          setAnimPos(new Map());
          setIsAnimating(false);
        }
      };

      animFrameRef.current = requestAnimationFrame(tick);
    },
    []
  );

  /* ─── Firestore subscription ─────────────────────────────────── */
  useEffect(() => {
    if (!teamId) return;

    let cancelled = false;

    /* Real-time subscription */
    const unsubscribe = onSnapshot(
      doc(db, "tactic_live_state", teamId),
      (snap) => {
        if (cancelled || !snap.exists()) return;

        const live = snap.data() as LiveState;
        setPlayers(live.players ?? []);
        setArrows(live.arrows ?? []);
        setDrawings(live.drawings ?? []);

        if (!connected) setConnected(true);

        if (live.animationPlaying && live.animationStartTime) {
          const elapsed =
            Date.now() - new Date(live.animationStartTime).getTime();
          startAnimationAt(elapsed, live.players ?? [], live.arrows ?? []);
        } else if (!live.animationPlaying) {
          cancelAnimationFrame(animFrameRef.current);
          setIsAnimating(false);
          setAnimPos(new Map());
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [teamId, startAnimationAt]);

  /* ─── No team ID ─────────────────────────────────────────────── */
  if (!teamId) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 p-8">
        <span className="text-6xl">🏀</span>
        <p className="text-white/60 text-base text-center max-w-sm">
          Ingen lag-ID angiven. Öppna taktiktavlan i appen och tryck på{" "}
          <strong className="text-white/80">📺 Casta</strong> för att starta
          visningen på den här skärmen.
        </p>
      </div>
    );
  }

  /* ─── Main cast view ─────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden">
      {/* Court — sized to fill the screen while preserving the aspect ratio */}
      <div
        style={{
          width: "min(100vw, calc(100vh * 380 / 510))",
          height: "min(100vh, calc(100vw * 510 / 380))",
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-full"
          style={{ display: "block" }}
        >
          <ArrowMarker />
          <DrawingMarkers />
          <BasketballCourt />

          {/* Zone drawings (rendered behind other elements) */}
          {drawings.filter(d => d.type === "zone").map(d => {
            const x = Math.min(d.x1, d.x2) * (W / SOURCE_W);
            const y = Math.min(d.y1, d.y2) * (H / SOURCE_H);
            const w = Math.abs(d.x2 - d.x1) * (W / SOURCE_W);
            const h = Math.abs(d.y2 - d.y1) * (H / SOURCE_H);
            return <rect key={d.id} x={x} y={y} width={w} height={h} fill={d.color} stroke="none" />;
          })}
          {/* Other drawings */}
          {drawings.filter(d => d.type !== "zone").map(d => {
            const sx = W / SOURCE_W, sy = H / SOURCE_H;
            if (d.type === "arrow") {
              return <line key={d.id} x1={d.x1*sx} y1={d.y1*sy} x2={d.x2*sx} y2={d.y2*sy}
                stroke={d.color} strokeWidth={3} strokeLinecap="round" markerEnd="url(#cast-ah-y)" />;
            }
            if (d.type === "dashed") {
              return <line key={d.id} x1={d.x1*sx} y1={d.y1*sy} x2={d.x2*sx} y2={d.y2*sy}
                stroke={d.color} strokeWidth={3} strokeLinecap="round" strokeDasharray="12 6" markerEnd="url(#cast-ah-g)" />;
            }
            if (d.type === "circle") {
              const avgScale = (sx + sy) / 2;
              const r = Math.sqrt((d.x2 - d.x1) ** 2 + (d.y2 - d.y1) ** 2) * avgScale;
              return <circle key={d.id} cx={d.x1*sx} cy={d.y1*sy} r={r} stroke={d.color} strokeWidth={2.5} fill="none" />;
            }
            if (d.type === "rect") {
              const rx = Math.min(d.x1, d.x2) * sx, ry = Math.min(d.y1, d.y2) * sy;
              const rw = Math.abs(d.x2 - d.x1) * sx, rh = Math.abs(d.y2 - d.y1) * sy;
              return <rect key={d.id} x={rx} y={ry} width={rw} height={rh} stroke={d.color} strokeWidth={2.5} fill="none" />;
            }
            return null;
          })}

          {/* Movement arrows */}
          {arrows.map((a) => (
            <line
              key={a.id}
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              stroke="#facc15"
              strokeWidth={2.5}
              markerEnd="url(#arrowhead)"
              strokeLinecap="round"
            />
          ))}

          {/* Players */}
          {players.map((p) => {
            const pos = animPos.get(p.id);
            const cx = pos ? pos.x : p.x;
            const cy = pos ? pos.y : p.y;
            const isBall = p.team === "ball";
            const fill = p.team === "home" ? "#dc2626"
              : p.team === "away" ? "#2563eb"
              : p.type === "O" ? "#16a34a"
              : "#dc2626";
            const label = p.number != null ? String(p.number) : (p.type ?? "");
            if (isBall) {
              return (
                <g key={p.id} transform={`translate(${cx},${cy})`}>
                  <circle r={14} fill="#e8581c" stroke="#5a2700" strokeWidth={1.2} />
                  <path d="M-14,0 Q0,-6 14,0" stroke="#5a2700" strokeWidth={1.4} fill="none" />
                  <path d="M-14,0 Q0,6 14,0" stroke="#5a2700" strokeWidth={1.4} fill="none" />
                  <path d="M0,-14 Q6,0 0,14" stroke="#5a2700" strokeWidth={1.4} fill="none" />
                  <path d="M0,-14 Q-6,0 0,14" stroke="#5a2700" strokeWidth={1.4} fill="none" />
                </g>
              );
            }
            return (
              <g key={p.id} transform={`translate(${cx},${cy})`}>
                <circle
                  r={18}
                  fill={fill}
                  stroke="white"
                  strokeWidth={2}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={16}
                  fontWeight="bold"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Top overlay — team name + animating indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
        {teamName && (
          <span className="text-white/70 text-sm font-semibold bg-black/50 px-3 py-1 rounded-full">
            🏀 {teamName}
          </span>
        )}
        {isAnimating && (
          <span className="text-orange-300 text-sm font-semibold bg-black/50 px-3 py-1 rounded-full animate-pulse">
            🎬 Animerar…
          </span>
        )}
      </div>

      {/* Bottom-right — connection status */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 text-white/30 text-xs pointer-events-none">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            connected ? "bg-green-400" : "bg-yellow-400 animate-pulse"
          }`}
        />
        {connected ? "Live" : "Ansluter…"}
      </div>
    </div>
  );
}

/* ─── Page export (Suspense required for useSearchParams) ────── */
export default function CastPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-black flex items-center justify-center">
          <span className="text-white/30 text-sm">Laddar…</span>
        </div>
      }
    >
      <CastBoard />
    </Suspense>
  );
}
