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

type DrawingType = "arrow" | "dashed" | "circle" | "rect" | "zone";

interface Drawing {
  id: string;
  type: DrawingType;
  color: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: { x: number; y: number }[];
}

/** One step in a multi-step tactic (mirrors taktik/page.tsx) */
interface Step {
  id: string;
  players: Player[];
  drawings: Drawing[];
}

interface LiveState {
  teamId: string;
  players: Player[];
  drawings?: Drawing[];
  /** Multi-step tactic array written by taktik/page.tsx */
  steps?: Step[];
  animationPlaying: boolean;
  animationStartTime: string | null;
}

/* ─── Court dimensions (landscape, matching main tactic board) ── */
const CW = 760;
const CH = 460;
const BX = 20, BY = 20, BW = 720, BH = 420;
const MCX = BX + BW / 2;
const MCY = BY + BH / 2;
const LBX = 60;
const RBX = 700;
const PAINT_D = 155;
const PAINT_H = 74;
const L_FT_X = BX + PAINT_D;
const R_FT_X = BX + BW - PAINT_D;
const FT_R = 55;
const TP3_Y1 = 63;
const TP3_Y2 = 397;
const TP3_R = 181;
const L_TP3_X = 130;
const R_TP3_X = 630;
/** Must match ANIM_MS in taktik/page.tsx */
const ANIM_MS = 1200;

/* ─── Animation helpers ──────────────────────────────────────── */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/* ─── SVG marker defs ────────────────────────────────────────── */
function CastMarkerDefs() {
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
  const lp = { stroke: "rgba(255,255,255,0.88)", strokeWidth: 2, fill: "none" };
  return (
    <g>
      <rect x={0} y={0} width={CW} height={CH} fill="#c8803a" />
      {Array.from({ length: 14 }, (_, i) => (
        <line key={i} x1={0} y1={22 + i * 31} x2={CW} y2={22 + i * 31}
          stroke="rgba(155,85,15,0.22)" strokeWidth={1} />
      ))}
      <rect x={BX} y={BY} width={BW} height={BH} {...lp} />
      <line x1={MCX} y1={BY} x2={MCX} y2={BY + BH} {...lp} />
      <circle cx={MCX} cy={MCY} r={55} {...lp} />
      <circle cx={MCX} cy={MCY} r={3} fill="rgba(255,255,255,0.88)" />
      {/* Left basket */}
      <rect x={BX} y={MCY - PAINT_H} width={PAINT_D} height={PAINT_H * 2}
        {...lp} fill="rgba(255,255,255,0.07)" />
      <line x1={L_FT_X} y1={MCY - PAINT_H} x2={L_FT_X} y2={MCY + PAINT_H} {...lp} />
      <path d={`M ${L_FT_X} ${MCY - FT_R} A ${FT_R} ${FT_R} 0 0 1 ${L_FT_X} ${MCY + FT_R}`} {...lp} />
      <path d={`M ${L_FT_X} ${MCY - FT_R} A ${FT_R} ${FT_R} 0 0 0 ${L_FT_X} ${MCY + FT_R}`}
        stroke="rgba(255,255,255,0.88)" strokeWidth={2} fill="none" strokeDasharray="8 5" />
      <line x1={BX + 22} y1={MCY - 27} x2={BX + 22} y2={MCY + 27}
        stroke="rgba(255,255,255,0.88)" strokeWidth={3} />
      <circle cx={LBX} cy={MCY} r={11} {...lp} />
      <line x1={BX} y1={TP3_Y1} x2={L_TP3_X} y2={TP3_Y1} {...lp} />
      <line x1={BX} y1={TP3_Y2} x2={L_TP3_X} y2={TP3_Y2} {...lp} />
      <path d={`M ${L_TP3_X} ${TP3_Y1} A ${TP3_R} ${TP3_R} 0 0 1 ${L_TP3_X} ${TP3_Y2}`} {...lp} />
      {/* Right basket */}
      <rect x={BX + BW - PAINT_D} y={MCY - PAINT_H} width={PAINT_D} height={PAINT_H * 2}
        {...lp} fill="rgba(255,255,255,0.07)" />
      <line x1={R_FT_X} y1={MCY - PAINT_H} x2={R_FT_X} y2={MCY + PAINT_H} {...lp} />
      <path d={`M ${R_FT_X} ${MCY - FT_R} A ${FT_R} ${FT_R} 0 0 0 ${R_FT_X} ${MCY + FT_R}`} {...lp} />
      <path d={`M ${R_FT_X} ${MCY - FT_R} A ${FT_R} ${FT_R} 0 0 1 ${R_FT_X} ${MCY + FT_R}`}
        stroke="rgba(255,255,255,0.88)" strokeWidth={2} fill="none" strokeDasharray="8 5" />
      <line x1={BX + BW - 22} y1={MCY - 27} x2={BX + BW - 22} y2={MCY + 27}
        stroke="rgba(255,255,255,0.88)" strokeWidth={3} />
      <circle cx={RBX} cy={MCY} r={11} {...lp} />
      <line x1={BX + BW} y1={TP3_Y1} x2={R_TP3_X} y2={TP3_Y1} {...lp} />
      <line x1={BX + BW} y1={TP3_Y2} x2={R_TP3_X} y2={TP3_Y2} {...lp} />
      <path d={`M ${R_TP3_X} ${TP3_Y1} A ${TP3_R} ${TP3_R} 0 0 0 ${R_TP3_X} ${TP3_Y2}`} {...lp} />
    </g>
  );
}

/* ─── Inner board (needs Suspense for useSearchParams) ───────── */
function CastBoard() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get("team");
  const teamName = searchParams.get("name") ?? "";

  const [players, setPlayers] = useState<Player[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [animPos, setAnimPos] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());
  const [isAnimating, setIsAnimating] = useState(false);
  const [connected, setConnected] = useState(false);

  const animFrameRef = useRef<number>(0);
  const animStateRef = useRef<{
    isPlaying: boolean;
    stepIdx: number;
    stepStart: number;
    steps: Step[];
  }>({ isPlaying: false, stepIdx: 0, stepStart: 0, steps: [] });

  /* ─── Step-based animation engine (mirrors taktik/page.tsx) ─── */
  const startAnimation = useCallback(
    (offsetMs: number, liveSteps: Step[]) => {
      cancelAnimationFrame(animFrameRef.current);
      animStateRef.current.isPlaying = false;

      if (liveSteps.length < 2) return;

      const total = (liveSteps.length - 1) * ANIM_MS;

      /* Animation already finished — jump to final step */
      if (offsetMs >= total) {
        const lastStep = liveSteps[liveSteps.length - 1];
        setPlayers(lastStep.players);
        setDrawings(lastStep.drawings);
        setAnimPos(new Map());
        setIsAnimating(false);
        return;
      }

      const si = Math.min(Math.floor(offsetMs / ANIM_MS), liveSteps.length - 2);
      const stepElapsed = offsetMs - si * ANIM_MS;
      const now = performance.now();

      animStateRef.current = {
        isPlaying: true,
        stepIdx: si,
        stepStart: now - stepElapsed,
        steps: liveSteps,
      };
      setIsAnimating(true);

      const tick = (ts: number) => {
        const state = animStateRef.current;
        if (!state.isPlaying) return;

        const fromStep = state.steps[state.stepIdx];
        const toStep = state.steps[state.stepIdx + 1];
        const elapsed = ts - state.stepStart;
        const raw = Math.min(elapsed / ANIM_MS, 1);
        const t = easeInOut(raw);

        /* Show drawings from the step being animated away from */
        setDrawings(fromStep.drawings);
        /* Update base players so newly added players are visible */
        setPlayers(fromStep.players);

        /* Interpolate each player toward its position in the next step */
        const newPos = new Map<string, { x: number; y: number }>();
        for (const from of fromStep.players) {
          const to = toStep.players.find((p) => p.id === from.id);
          newPos.set(from.id, {
            x: from.x + ((to?.x ?? from.x) - from.x) * t,
            y: from.y + ((to?.y ?? from.y) - from.y) * t,
          });
        }
        setAnimPos(newPos);

        if (raw >= 1) {
          if (state.stepIdx < state.steps.length - 2) {
            /* Advance to next step-to-step transition */
            animStateRef.current = {
              ...state,
              stepIdx: state.stepIdx + 1,
              stepStart: ts,
            };
            animFrameRef.current = requestAnimationFrame(tick);
          } else {
            /* All steps done */
            animStateRef.current.isPlaying = false;
            const lastStep = state.steps[state.steps.length - 1];
            setPlayers(lastStep.players);
            setDrawings(lastStep.drawings);
            setAnimPos(new Map());
            setIsAnimating(false);
          }
        } else {
          animFrameRef.current = requestAnimationFrame(tick);
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
        const liveSteps = (live.steps ?? []) as Step[];

        setPlayers(live.players ?? []);
        setDrawings(live.drawings ?? []);
        setConnected(true);

        if (live.animationPlaying && live.animationStartTime && liveSteps.length >= 2) {
          const elapsed =
            Date.now() - new Date(live.animationStartTime).getTime();
          startAnimation(elapsed, liveSteps);
        } else if (!live.animationPlaying) {
          cancelAnimationFrame(animFrameRef.current);
          animStateRef.current.isPlaying = false;
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
  }, [teamId, startAnimation]);

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
      {/* Court — sized to fill the screen while preserving the landscape aspect ratio */}
      <div
        style={{
          width: "min(100vw, calc(100vh * 760 / 460))",
          height: "min(100vh, calc(100vw * 460 / 760))",
        }}
      >
        <svg
          viewBox={`0 0 ${CW} ${CH}`}
          className="w-full h-full"
          style={{ display: "block" }}
        >
          <CastMarkerDefs />
          <BasketballCourt />

          {/* Zone drawings (rendered behind other elements) */}
          {drawings.filter(d => d.type === "zone").map(d => {
            const x = Math.min(d.x1, d.x2);
            const y = Math.min(d.y1, d.y2);
            const w = Math.abs(d.x2 - d.x1);
            const h = Math.abs(d.y2 - d.y1);
            return <rect key={d.id} x={x} y={y} width={w} height={h} fill={d.color} stroke="none" />;
          })}
          {/* Other drawings */}
          {drawings.filter(d => d.type !== "zone").map(d => {
            if (d.type === "arrow") {
              if (d.points && d.points.length >= 2) {
                const path = d.points.reduce((acc, pt, i) => {
                  if (i === 0) return `M ${pt.x} ${pt.y}`;
                  if (i < d.points!.length - 1) {
                    const mx = (pt.x + d.points![i + 1].x) / 2;
                    const my = (pt.y + d.points![i + 1].y) / 2;
                    return `${acc} Q ${pt.x} ${pt.y} ${mx} ${my}`;
                  }
                  return `${acc} L ${pt.x} ${pt.y}`;
                }, "");
                return <path key={d.id} d={path} stroke={d.color} strokeWidth={2.5}
                  fill="none" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#cast-ah-y)" />;
              }
              return <line key={d.id} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
                stroke={d.color} strokeWidth={2.5} strokeLinecap="round" markerEnd="url(#cast-ah-y)" />;
            }
            if (d.type === "dashed") {
              if (d.points && d.points.length >= 2) {
                const path = d.points.reduce((acc, pt, i) => {
                  if (i === 0) return `M ${pt.x} ${pt.y}`;
                  if (i < d.points!.length - 1) {
                    const mx = (pt.x + d.points![i + 1].x) / 2;
                    const my = (pt.y + d.points![i + 1].y) / 2;
                    return `${acc} Q ${pt.x} ${pt.y} ${mx} ${my}`;
                  }
                  return `${acc} L ${pt.x} ${pt.y}`;
                }, "");
                return <path key={d.id} d={path} stroke={d.color} strokeWidth={2.5}
                  fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="9 5" markerEnd="url(#cast-ah-g)" />;
              }
              return <line key={d.id} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
                stroke={d.color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray="12 6" markerEnd="url(#cast-ah-g)" />;
            }
            if (d.type === "circle") {
              const r = Math.sqrt((d.x2 - d.x1) ** 2 + (d.y2 - d.y1) ** 2);
              return <circle key={d.id} cx={d.x1} cy={d.y1} r={r} stroke={d.color} strokeWidth={2.5} fill="none" />;
            }
            if (d.type === "rect") {
              const rx = Math.min(d.x1, d.x2), ry = Math.min(d.y1, d.y2);
              const rw = Math.abs(d.x2 - d.x1), rh = Math.abs(d.y2 - d.y1);
              return <rect key={d.id} x={rx} y={ry} width={rw} height={rh} stroke={d.color} strokeWidth={2.5} fill="none" />;
            }
            return null;
          })}

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
                <circle r={18} fill={fill} stroke="white" strokeWidth={2} />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={16}
                  fontWeight="bold"
                >
                  {p.number != null ? String(p.number) : ""}
                </text>
                {p.name && (
                  <>
                    <text y={31} textAnchor="middle" fill="rgba(0,0,0,0.75)" stroke="rgba(0,0,0,0.75)"
                      strokeWidth={2.5} strokeLinejoin="round" fontSize={9} fontWeight="bold">{p.name}</text>
                    <text y={31} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">{p.name}</text>
                  </>
                )}
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
