"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/app/context/AuthContext";
import {
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebaseClient";
import { useCast } from "@/app/hooks/useCast";

/* ─── Types ─────────────────────────────────────────────────────────────── */

type PlayerTeam = "home" | "away" | "ball";

interface Player {
  id: string;
  team: PlayerTeam;
  number?: number;
  name?: string;
  role?: string;
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

interface Step {
  id: string;
  label: string;
  players: Player[];
  drawings: Drawing[];
}

interface TacticDoc {
  id: string;
  name: string;
  teamId: string;
  steps: Step[];
  coachNotes: string;
  createdAt: string;
}

type Tool = "select" | "arrow" | "dashed" | "circle" | "rect" | "zone" | "erase";

/* ─── Court constants ────────────────────────────────────────────────────── */

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

/* ─── App constants ──────────────────────────────────────────────────────── */

const ANIM_MS = 1200;
const HOME_NAMES = ["PG", "SG", "SF", "PF", "C"];
const MIN_SHAPE_DIST = 5;
const MIN_LINE_DIST  = 10;

const TACTICAL_ROLES = [
  "Ball Handler",
  "P&R-skärmare",
  "Cutter",
  "Skjutare",
  "Post-spelare",
  "Off-Ball Screen",
  "Flare Screen",
  "Helpersida",
  "Spjutstans",
  "Hjälpförsvarare",
];

const ZONE_COLORS = [
  { label: "Röd",  color: "rgba(239,68,68,0.35)" },
  { label: "Blå",  color: "rgba(59,130,246,0.35)" },
  { label: "Grön", color: "rgba(34,197,94,0.35)" },
  { label: "Gul",  color: "rgba(234,179,8,0.35)" },
  { label: "Lila", color: "rgba(168,85,247,0.35)" },
];

const ARROW_COLOR  = "#facc15";
const DASHED_COLOR = "#a3e635";
const SHAPE_COLOR  = "#f472b6";

/* ─── Initial players ────────────────────────────────────────────────────── */

function makeInitialPlayers(): Player[] {
  const homePos = [
    { x: 380, y: 195 },
    { x: 255, y: 260 }, { x: 505, y: 260 },
    { x: 210, y: 330 }, { x: 550, y: 330 },
  ];
  const awayPos = [
    { x: 380, y: 215 },
    { x: 272, y: 272 }, { x: 488, y: 272 },
    { x: 225, y: 340 }, { x: 535, y: 340 },
  ];
  return [
    ...homePos.map((p, i) => ({
      id: `home-${i + 1}`, team: "home" as const,
      number: i + 1, name: HOME_NAMES[i], x: p.x, y: p.y,
    })),
    ...awayPos.map((p, i) => ({
      id: `away-${i + 1}`, team: "away" as const,
      number: i + 1, x: p.x, y: p.y,
    })),
    { id: "ball-1", team: "ball" as const, x: 380, y: 184 },
  ];
}

function makeStep(label: string, prev?: Step): Step {
  return {
    id: crypto.randomUUID(),
    label,
    players: prev ? prev.players.map(p => ({ ...p })) : makeInitialPlayers(),
    drawings: [],
  };
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

/* ─── SVG marker defs ────────────────────────────────────────────────────── */
function AllMarkerDefs() {
  return (
    <defs>
      <marker id="ah-y" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={ARROW_COLOR} />
      </marker>
      <marker id="ah-g" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill={DASHED_COLOR} />
      </marker>
    </defs>
  );
}

/* ─── Basketball court ───────────────────────────────────────────────────── */
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

/* ─── Player marker ──────────────────────────────────────────────────────── */
function PlayerMarker({
  player, isSelected, onPointerDown, interactive,
}: {
  player: Player;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  interactive: boolean;
}) {
  const cls = interactive ? "cursor-grab active:cursor-grabbing" : "";

  if (player.team === "ball") {
    return (
      <g transform={`translate(${player.x},${player.y})`}
        onPointerDown={onPointerDown} style={{ touchAction: "none" }} className={cls}>
        {isSelected && <circle r={22} fill="none" stroke="#facc15" strokeWidth={2.5} strokeDasharray="4 3" />}
        <circle r={14} fill="#e8581c" stroke="#5a2700" strokeWidth={1.2} />
        <path d="M-14,0 Q0,-6 14,0" stroke="#5a2700" strokeWidth={1.4} fill="none" />
        <path d="M-14,0 Q0,6 14,0" stroke="#5a2700" strokeWidth={1.4} fill="none" />
        <path d="M0,-14 Q6,0 0,14" stroke="#5a2700" strokeWidth={1.4} fill="none" />
        <path d="M0,-14 Q-6,0 0,14" stroke="#5a2700" strokeWidth={1.4} fill="none" />
        <text y={30} textAnchor="middle" fill="rgba(0,0,0,0.7)" stroke="rgba(0,0,0,0.7)"
          strokeWidth={2} strokeLinejoin="round" fontSize={9} fontWeight="bold">BOLL</text>
        <text y={30} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">BOLL</text>
      </g>
    );
  }

  const fill = player.team === "home" ? "#dc2626" : "#2563eb";
  const hasRole = !!(player.role && player.role.trim());

  return (
    <g transform={`translate(${player.x},${player.y})`}
      onPointerDown={onPointerDown} style={{ touchAction: "none" }} className={cls}>
      {isSelected && <circle r={24} fill="none" stroke="#facc15" strokeWidth={2.5} strokeDasharray="4 3" />}
      <circle r={18} fill={fill} stroke="white" strokeWidth={2.5} />
      <text textAnchor="middle" dominantBaseline="central" fill="white" fontSize={13} fontWeight="bold">
        {player.number}
      </text>
      {player.name && (
        <>
          <text y={31} textAnchor="middle" fill="rgba(0,0,0,0.75)" stroke="rgba(0,0,0,0.75)"
            strokeWidth={2.5} strokeLinejoin="round" fontSize={9} fontWeight="bold">{player.name}</text>
          <text y={31} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">{player.name}</text>
        </>
      )}
      {hasRole && (
        <>
          <text y={player.name ? 43 : 31} textAnchor="middle"
            fill="rgba(0,0,0,0.75)" stroke="rgba(0,0,0,0.75)"
            strokeWidth={2} strokeLinejoin="round" fontSize={8} fontStyle="italic">{player.role}</text>
          <text y={player.name ? 43 : 31} textAnchor="middle"
            fill="#fcd34d" fontSize={8} fontStyle="italic">{player.role}</text>
        </>
      )}
    </g>
  );
}

/* ─── Freehand path helper ───────────────────────────────────────────────── */
function pointsToPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x} ${pts[i].y} ${mx} ${my}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
  return d;
}

/* ─── Drawing element ────────────────────────────────────────────────────── */
function DrawingEl({
  d, erasable, onErase,
}: {
  d: Drawing;
  erasable: boolean;
  onErase?: () => void;
}) {
  const ep = erasable ? { onClick: onErase, className: "cursor-pointer" } : {};
  switch (d.type) {
    case "arrow":
      if (d.points && d.points.length >= 2) {
        return (
          <path d={pointsToPath(d.points)}
            stroke={d.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            fill="none" markerEnd="url(#ah-y)" {...ep} />
        );
      }
      return (
        <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
          stroke={d.color} strokeWidth={2.5} strokeLinecap="round"
          markerEnd="url(#ah-y)" {...ep} />
      );
    case "dashed":
      if (d.points && d.points.length >= 2) {
        return (
          <path d={pointsToPath(d.points)}
            stroke={d.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            fill="none" strokeDasharray="9 5" markerEnd="url(#ah-g)" {...ep} />
        );
      }
      return (
        <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2}
          stroke={d.color} strokeWidth={2.5} strokeLinecap="round"
          strokeDasharray="9 5" markerEnd="url(#ah-g)" {...ep} />
      );
    case "circle": {
      const r = Math.sqrt((d.x2 - d.x1) ** 2 + (d.y2 - d.y1) ** 2);
      return (
        <circle cx={d.x1} cy={d.y1} r={r}
          stroke={d.color} strokeWidth={2} fill="none" {...ep} />
      );
    }
    case "rect":
      return (
        <rect
          x={Math.min(d.x1, d.x2)} y={Math.min(d.y1, d.y2)}
          width={Math.abs(d.x2 - d.x1)} height={Math.abs(d.y2 - d.y1)}
          stroke={d.color} strokeWidth={2} fill="none" {...ep} />
      );
    case "zone":
      return (
        <rect
          x={Math.min(d.x1, d.x2)} y={Math.min(d.y1, d.y2)}
          width={Math.abs(d.x2 - d.x1)} height={Math.abs(d.y2 - d.y1)}
          fill={d.color} stroke="none" {...ep} />
      );
    default:
      return null;
  }
}

/* ─── Sync badge ─────────────────────────────────────────────────────────── */
function SyncBadge({ status }: { status: "offline" | "connecting" | "live" }) {
  const c = {
    offline:    { dot: "bg-slate-400",                label: "Offline (lokal)" },
    connecting: { dot: "bg-yellow-400 animate-pulse", label: "Ansluter\u2026" },
    live:       { dot: "bg-green-400",                label: "Realtid aktiv" },
  }[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className={`w-2 h-2 rounded-full ${c.dot}`} aria-hidden="true" />
      {c.label}
    </span>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function TaktikPage() {
  const { user, getMyTeams } = useAuth();
  const myTeams = getMyTeams();

  /* ── Team selector ─────────────────────────────────────────────────────── */
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const activeTeam = myTeams.find((t) => t.id === selectedTeamId) ?? myTeams[0] ?? null;
  const isOnline = !!activeTeam;

  const [steps, setSteps] = useState<Step[]>(() => [makeStep("Steg 1")]);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [zoneColor, setZoneColor] = useState(ZONE_COLORS[0].color);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCursor, setDrawCursor] = useState<{ x: number; y: number } | null>(null);
  const freehandPointsRef = useRef<{ x: number; y: number }[]>([]);

  const undoStackRef = useRef<Step[][]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playStepIdx, setPlayStepIdx] = useState(0);
  const [playProgress, setPlayProgress] = useState(0);

  const [rightTab, setRightTab] = useState<"players" | "tactics" | "notes">("players");
  const [showRight, setShowRight] = useState(true);

  const [savedTactics, setSavedTactics] = useState<TacticDoc[]>([]);
  const [tacticName, setTacticName] = useState("");
  const [coachNotes, setCoachNotes] = useState("");

  const [syncStatus, setSyncStatus] = useState<"offline" | "connecting" | "live">("offline");
  const suppressRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fullscreen ────────────────────────────────────────────────────────── */
  const boardRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const animStateRef = useRef({ isPlaying: false, stepIdx: 0, stepStart: 0, steps: [] as Step[] });
  const animRafRef = useRef<number>(0);
  const liveRef = useRef({ steps, currentStepIdx, coachNotes });

  useEffect(() => {
    liveRef.current = { steps, currentStepIdx, coachNotes };
    animStateRef.current.steps = steps;
  }, [steps, currentStepIdx, coachNotes]);

  const currentStep = steps[currentStepIdx] ?? steps[0];

  const displayPlayers = useMemo(() => {
    const base = steps[currentStepIdx]?.players ?? [];
    if (!isPlaying || steps.length < 2) return base;
    const from = steps[Math.min(playStepIdx, steps.length - 1)];
    const to   = steps[Math.min(playStepIdx + 1, steps.length - 1)];
    if (!from || !to) return base;
    const t = easeInOut(playProgress);
    return from.players.map(fp => {
      const tp = to.players.find(p => p.id === fp.id);
      if (!tp) return fp;
      return { ...fp, x: fp.x + (tp.x - fp.x) * t, y: fp.y + (tp.y - fp.y) * t };
    });
  }, [steps, currentStepIdx, isPlaying, playStepIdx, playProgress]);

  const displayDrawings = useMemo(() => {
    if (isPlaying && steps.length >= 2)
      return steps[Math.min(playStepIdx, steps.length - 1)]?.drawings ?? [];
    return steps[currentStepIdx]?.drawings ?? [];
  }, [steps, currentStepIdx, isPlaying, playStepIdx]);

  const teamIdForCast   = activeTeam?.id ?? null;
  const teamNameForCast = activeTeam?.name ?? null;
  const castUrl = useMemo(() => {
    if (typeof window === "undefined" || !teamIdForCast || !teamNameForCast) return null;
    return `${window.location.origin}/cast?team=${teamIdForCast}&name=${encodeURIComponent(teamNameForCast)}`;
  }, [teamIdForCast, teamNameForCast]);
  const { isAvailable: castAvailable, isPresenting, startCast, stopCast } = useCast(castUrl);

  const pushLive = useCallback(() => {
    if (!isOnline || !user || !activeTeam) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { steps: s, currentStepIdx: ci, coachNotes: cn } = liveRef.current;
      const step = s[ci] ?? s[0];
      if (!step) return;
      suppressRef.current += 1;
      await setDoc(doc(db, "tactic_live_state", activeTeam.id), {
        teamId: activeTeam.id,
        players: step.players,
        drawings: step.drawings,
        steps: s,
        currentStepIdx: ci,
        coachNotes: cn,
        animationPlaying: false,
        animationStartTime: null,
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
      });
    }, 150);
  }, [isOnline, user, activeTeam]);

  const pushUndo = useCallback(() => {
    const snapshot = structuredClone(liveRef.current.steps) as Step[];
    undoStackRef.current = [...undoStackRef.current.slice(-29), snapshot];
    setCanUndo(true);
  }, []);

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1];
    undoStackRef.current = stack.slice(0, -1);
    setCanUndo(stack.length > 1);
    setSteps(prev);
    pushLive();
  }, [pushLive]);

  const getSVGCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (CW / rect.width),
      y: (clientY - rect.top)  * (CH / rect.height),
    };
  }, []);

  const updateCurrentStep = useCallback((updater: (s: Step) => Step) => {
    setSteps(prev => prev.map((s, i) => i === currentStepIdx ? updater(s) : s));
  }, [currentStepIdx]);

  const movePlayer = useCallback((id: string, x: number, y: number) => {
    setSteps(prev => prev.map((s, i) =>
      i === currentStepIdx
        ? { ...s, players: s.players.map(p => p.id === id ? { ...p, x, y } : p) }
        : s
    ));
  }, [currentStepIdx]);

  const addDrawing = useCallback((d: Drawing) => {
    updateCurrentStep(s => ({ ...s, drawings: [...s.drawings, d] }));
  }, [updateCurrentStep]);

  const removeDrawing = useCallback((id: string) => {
    updateCurrentStep(s => ({ ...s, drawings: s.drawings.filter(d => d.id !== id) }));
  }, [updateCurrentStep]);

  const removePlayer = useCallback((id: string) => {
    updateCurrentStep(s => ({ ...s, players: s.players.filter(p => p.id !== id) }));
  }, [updateCurrentStep]);

  const updatePlayerInfo = useCallback(
    (id: string, updates: Partial<Pick<Player, "name" | "role">>) => {
      setSteps(prev => prev.map(s => ({
        ...s,
        players: s.players.map(p => p.id === id ? { ...p, ...updates } : p),
      })));
    },
    []
  );

  const addStep = () => {
    const label = `Steg ${steps.length + 1}`;
    const newStep = makeStep(label, steps[currentStepIdx]);
    setSteps(s => [...s, newStep]);
    setCurrentStepIdx(steps.length);
    setSelectedPlayerId(null);
  };

  const removeStep = (idx: number) => {
    if (steps.length <= 1) return;
    setSteps(prev => prev.filter((_, i) => i !== idx));
    setCurrentStepIdx(prev => Math.max(0, Math.min(prev, steps.length - 2)));
  };

  const clearBoard = () => {
    undoStackRef.current = [];
    setCanUndo(false);
    setSteps([makeStep("Steg 1")]);
    setCurrentStepIdx(0);
    setCoachNotes("");
    setSelectedPlayerId(null);
    stopAnimation();
  };

  const handleSVGPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPlaying) return;
    const coords = getSVGCoords(e.clientX, e.clientY);
    if (["arrow", "dashed", "circle", "rect", "zone"].includes(tool)) {
      setDrawStart(coords);
      setDrawCursor(coords);
      if (tool === "arrow" || tool === "dashed") {
        freehandPointsRef.current = [coords];
      }
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (tool === "select") {
      setSelectedPlayerId(null);
    }
  };

  const handleSVGPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPlaying) return;
    const coords = getSVGCoords(e.clientX, e.clientY);
    if (drawStart) {
      if ((tool === "arrow" || tool === "dashed") && freehandPointsRef.current.length > 0) {
        const last = freehandPointsRef.current[freehandPointsRef.current.length - 1];
        const dist = Math.sqrt((coords.x - last.x) ** 2 + (coords.y - last.y) ** 2);
        if (dist > 4) {
          freehandPointsRef.current = [...freehandPointsRef.current, coords];
        }
      }
      setDrawCursor(coords);
    }
    if (tool === "select" && dragId) {
      movePlayer(dragId, coords.x, coords.y);
      pushLive();
    }
  };

  const handleSVGPointerUp = () => {
    if (isPlaying) return;
    if (drawStart && drawCursor) {
      const isFreehandTool = tool === "arrow" || tool === "dashed";
      const fpts = freehandPointsRef.current;
      if (isFreehandTool && fpts.length >= 2) {
        const color = tool === "arrow" ? ARROW_COLOR : DASHED_COLOR;
        pushUndo();
        addDrawing({
          id: crypto.randomUUID(), type: tool as DrawingType, color,
          x1: fpts[0].x, y1: fpts[0].y, x2: fpts[fpts.length - 1].x, y2: fpts[fpts.length - 1].y,
          points: [...fpts],
        });
        pushLive();
      } else {
        const dx = drawCursor.x - drawStart.x;
        const dy = drawCursor.y - drawStart.y;
        const minDist = ["circle", "rect", "zone"].includes(tool) ? MIN_SHAPE_DIST : MIN_LINE_DIST;
        if (Math.sqrt(dx * dx + dy * dy) > minDist) {
          const color =
            tool === "arrow"  ? ARROW_COLOR
            : tool === "dashed" ? DASHED_COLOR
            : tool === "zone"   ? zoneColor
            : SHAPE_COLOR;
          pushUndo();
          addDrawing({
            id: crypto.randomUUID(), type: tool as DrawingType, color,
            x1: drawStart.x, y1: drawStart.y, x2: drawCursor.x, y2: drawCursor.y,
          });
          pushLive();
        }
      }
    }
    freehandPointsRef.current = [];
    setDrawStart(null);
    setDrawCursor(null);
    setDragId(null);
  };

  const handlePlayerPointerDown = (e: React.PointerEvent, id: string) => {
    if (isPlaying) return;
    e.stopPropagation();
    if (tool === "select") {
      pushUndo();
      setDragId(id);
      setSelectedPlayerId(id);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } else if (tool === "erase") {
      pushUndo();
      removePlayer(id);
      pushLive();
    }
  };

  const handleDrawingClick = (id: string) => {
    if (isPlaying || tool !== "erase") return;
    pushUndo();
    removeDrawing(id);
    pushLive();
  };

  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animRafRef.current);
    animStateRef.current.isPlaying = false;
    setIsPlaying(false);
    setPlayProgress(0);
  }, []);

  const playAnimation = () => {
    if (steps.length < 2) return;
    animStateRef.current = { isPlaying: true, stepIdx: 0, stepStart: performance.now(), steps };
    setIsPlaying(true);
    setPlayStepIdx(0);
    setPlayProgress(0);
    if (isOnline && user && activeTeam) {
      suppressRef.current += 1;
      setDoc(doc(db, "tactic_live_state", activeTeam.id), {
        teamId: activeTeam.id,
        players: steps[0].players,
        drawings: steps[0].drawings,
        steps,
        currentStepIdx,
        coachNotes,
        animationPlaying: true,
        animationStartTime: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
      });
    }
  };

  useEffect(() => {
    if (!isPlaying) return;
    let alive = true;
    const tick = (now: number) => {
      if (!alive) return;
      const state = animStateRef.current;
      if (!state.isPlaying) return;
      const elapsed  = now - state.stepStart;
      const progress = Math.min(elapsed / ANIM_MS, 1);
      setPlayProgress(progress);
      setPlayStepIdx(state.stepIdx);
      if (progress >= 1) {
        if (state.stepIdx < state.steps.length - 2) {
          animStateRef.current.stepIdx += 1;
          animStateRef.current.stepStart = now;
        } else {
          animStateRef.current.isPlaying = false;
          setIsPlaying(false);
          setPlayProgress(0);
          setCurrentStepIdx(state.steps.length - 1);
          return;
        }
      }
      animRafRef.current = requestAnimationFrame(tick);
    };
    animRafRef.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(animRafRef.current); };
  }, [isPlaying]);

  useEffect(() => () => cancelAnimationFrame(animRafRef.current), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !isPlaying) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, isPlaying]);

  /* ── Fullscreen change detection ─────────────────────────────────────── */
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await boardRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      await document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!isOnline) {
      try {
        const saved = localStorage.getItem("basketball_tactics_v2");
        if (saved) setSavedTactics(JSON.parse(saved));
      } catch { /* ignore */ }
      return;
    }
    setSyncStatus("connecting");
    let cancelled = false;

    const liveUnsub = onSnapshot(doc(db, "tactic_live_state", activeTeam!.id), snap => {
      if (!snap.exists() || cancelled) return;
      if (snap.metadata.hasPendingWrites) return;
      if (suppressRef.current > 0) { suppressRef.current -= 1; return; }
      const live = snap.data();
      if (live.steps?.length) {
        const liveSteps = live.steps as Step[];
        setSteps(liveSteps);
        if (typeof live.currentStepIdx === "number") setCurrentStepIdx(live.currentStepIdx);
        if (typeof live.coachNotes === "string") setCoachNotes(live.coachNotes);
        if (live.animationPlaying && live.animationStartTime && liveSteps.length >= 2) {
          const elapsed = Date.now() - new Date(live.animationStartTime as string).getTime();
          const total   = (liveSteps.length - 1) * ANIM_MS;
          if (elapsed < total) {
            const si          = Math.min(Math.floor(elapsed / ANIM_MS), liveSteps.length - 2);
            const stepElapsed = elapsed - si * ANIM_MS;
            animStateRef.current = {
              isPlaying: true, stepIdx: si,
              stepStart: performance.now() - stepElapsed,
              steps: liveSteps,
            };
            setPlayStepIdx(si);
            setIsPlaying(true);
          }
        } else if (!live.animationPlaying) {
          stopAnimation();
        }
      }
      if (!cancelled) setSyncStatus("live");
    });

    const tacticsUnsub = onSnapshot(
      query(collection(db, "tactics"), where("teamId", "==", activeTeam!.id), orderBy("createdAt", "desc")),
      snap => {
        if (cancelled) return;
        setSavedTactics(snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name as string,
            teamId: data.teamId as string,
            steps: (data.steps as Step[]) ?? [],
            coachNotes: (data.coachNotes as string) ?? "",
            createdAt: data.createdAt as string,
          };
        }));
      }
    );

    return () => {
      cancelled = true;
      liveUnsub();
      tacticsUnsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, activeTeam?.id]);

  const saveTactic = async () => {
    if (!tacticName.trim()) return;
    const payload = {
      name: tacticName.trim(),
      teamId: activeTeam?.id ?? "offline",
      steps,
      coachNotes,
      createdAt: new Date().toISOString(),
    };
    if (isOnline && activeTeam) {
      await addDoc(collection(db, "tactics"), payload);
    } else {
      const newDoc: TacticDoc = { ...payload, id: crypto.randomUUID() };
      const updated = [newDoc, ...savedTactics];
      setSavedTactics(updated);
      localStorage.setItem("basketball_tactics_v2", JSON.stringify(updated));
    }
    setTacticName("");
  };

  const loadTactic = (t: TacticDoc) => {
    undoStackRef.current = [];
    setCanUndo(false);
    const loadedSteps = t.steps?.length ? t.steps : [makeStep("Steg 1")];
    setSteps(loadedSteps);
    setCurrentStepIdx(0);
    setCoachNotes(t.coachNotes ?? "");
    setTacticName(t.name);
    setSelectedPlayerId(null);
    stopAnimation();
    pushLive();
  };

  const deleteTactic = async (id: string) => {
    if (isOnline) {
      await deleteDoc(doc(db, "tactics", id));
    } else {
      const updated = savedTactics.filter(t => t.id !== id);
      setSavedTactics(updated);
      localStorage.setItem("basketball_tactics_v2", JSON.stringify(updated));
    }
  };

  const exportPng = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const svgStr = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const scale  = 2;
      const canvas = document.createElement("canvas");
      canvas.width  = CW * scale;
      canvas.height = CH * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(b => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `${(tacticName || "taktik").replace(/[^\w\s-]/g, "").trim()}-steg${currentStepIdx + 1}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const svgCursor = isPlaying ? "cursor-default"
    : tool === "erase"  ? "cursor-pointer"
    : tool === "select" ? (dragId ? "cursor-grabbing" : "cursor-default")
    : "cursor-crosshair";

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="text-5xl">🔒</span>
        <h2 className="text-xl font-bold text-slate-800">Logga in för att använda taktiktavlan</h2>
        <p className="text-slate-500 text-sm text-center max-w-sm">
          Du måste vara inloggad för att se och redigera lagets taktiktavla.
        </p>
      </div>
    );
  }
  if (!activeTeam) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <span className="text-5xl">👥</span>
        <h2 className="text-xl font-bold text-slate-800">Du tillhör inget lag ännu</h2>
        <p className="text-slate-500 text-sm text-center max-w-sm">
          Gå med i ett lag via inbjudningskoden för att komma åt taktiktavlan.
        </p>
      </div>
    );
  }

  const selectedPlayer = selectedPlayerId
    ? currentStep?.players.find(p => p.id === selectedPlayerId) ?? null
    : null;

  const TOOLS: { id: Tool; label: string; bg: string; title: string }[] = [
    { id: "select", label: "⇖ Välj/Flytta",  bg: "bg-slate-700",  title: "Välj och flytta spelare" },
    { id: "arrow",  label: "→ Pil",                bg: "bg-yellow-500", title: "Rita rörelsepil (fast linje)" },
    { id: "dashed", label: "- - Pass",                  bg: "bg-lime-500",   title: "Rita passningslinje (streckad)" },
    { id: "circle", label: "○ Cirkel",              bg: "bg-pink-500",   title: "Markera ett område med cirkel" },
    { id: "rect",   label: "□ Ruta",                bg: "bg-pink-500",   title: "Markera ett område med ruta" },
    { id: "zone",   label: "■ Zon",                 bg: "bg-purple-600", title: "Färgmarkera en zon" },
    { id: "erase",  label: "✕ Radera",              bg: "bg-slate-500",  title: "Radera spelare eller rita" },
  ];

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏀</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Interaktiv Taktiktavla</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Team selector: show dropdown when user belongs to multiple teams */}
          {myTeams.length > 1 ? (
            <select
              value={activeTeam.id}
              onChange={(e) => {
                setSelectedTeamId(e.target.value);
                // Full board reset for the new team
                undoStackRef.current = [];
                setCanUndo(false);
                setSteps([makeStep("Steg 1")]);
                setCurrentStepIdx(0);
                setCoachNotes("");
                setTacticName("");
                setSelectedPlayerId(null);
                stopAnimation();
              }}
              className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              {myTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          ) : (
            <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{activeTeam.name}</span>
          )}
          <SyncBadge status={isOnline ? syncStatus : "offline"} />
          {castAvailable && (
            <button onClick={isPresenting ? stopCast : startCast}
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${isPresenting ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              <span>📺</span>{isPresenting ? "Castar" : "Casta"}
            </button>
          )}
          <button onClick={() => setShowRight(v => !v)}
            className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
            {showRight ? "◄ Dölj panel" : "► Visa panel"}
          </button>
          <button onClick={toggleFullscreen}
            title={isFullscreen ? "Avsluta helskärm (Esc)" : "Helskärm – döljer navigering"}
            className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">
            {isFullscreen ? "⛶ Avsluta" : "⛶ Helskärm"}
          </button>
        </div>
      </div>

      {isPresenting && (
        <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 font-medium flex items-center justify-between gap-2">
          <span>📺 Castar till extern skärm — alla ändringar syns direkt.</span>
          <button onClick={stopCast} className="shrink-0 font-semibold underline hover:no-underline">Koppla från</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        {TOOLS.map(({ id, label, bg, title }) => (
          <button key={id} title={title}
            onClick={() => !isPlaying && setTool(id)}
            disabled={isPlaying}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all ${bg} ${tool === id && !isPlaying ? "ring-2 ring-offset-1 ring-orange-400 scale-105" : "opacity-75 hover:opacity-100"} disabled:opacity-40`}>
            {label}
          </button>
        ))}
        {tool === "zone" && (
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <span className="text-xs text-slate-500 shrink-0">Zon:</span>
            {ZONE_COLORS.map(zc => (
              <button key={zc.color} title={zc.label}
                onClick={() => setZoneColor(zc.color)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${zoneColor === zc.color ? "border-slate-900 scale-125" : "border-transparent"}`}
                style={{ backgroundColor: zc.color.replace("0.35", "0.8") }} />
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={undo} disabled={!canUndo || isPlaying} title="Ångra (Ctrl+Z)"
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40">
            ↩ Ångra
          </button>
          <button onClick={clearBoard} disabled={isPlaying}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40">
            🗑 Ny tavla
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-3 flex-col xl:flex-row">

        {/* Court */}
        <div ref={boardRef} className={`flex-1 min-w-0 relative${isFullscreen ? " bg-black flex items-center justify-center" : ""}`}>
          <div className={`overflow-hidden${isFullscreen ? " w-full" : " bg-white rounded-2xl border border-slate-200 shadow-sm"}`}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CW} ${CH}`}
              className={`w-full select-none touch-none ${svgCursor}`}
              style={{ maxHeight: isFullscreen ? "100dvh" : "65vh" }}
              onPointerDown={handleSVGPointerDown}
              onPointerMove={handleSVGPointerMove}
              onPointerUp={handleSVGPointerUp}
            >
              <AllMarkerDefs />
              <BasketballCourt />
              {displayDrawings.filter(d => d.type === "zone").map(d => (
                <DrawingEl key={d.id} d={d} erasable={tool === "erase" && !isPlaying} onErase={() => handleDrawingClick(d.id)} />
              ))}
              {displayDrawings.filter(d => d.type !== "zone").map(d => (
                <DrawingEl key={d.id} d={d} erasable={tool === "erase" && !isPlaying} onErase={() => handleDrawingClick(d.id)} />
              ))}
              {drawStart && drawCursor && (() => {
                const pc = tool === "arrow" ? ARROW_COLOR : tool === "dashed" ? DASHED_COLOR : tool === "zone" ? zoneColor : SHAPE_COLOR;
                const fpts = freehandPointsRef.current;
                if (tool === "arrow") {
                  if (fpts.length >= 2) {
                    return <path d={pointsToPath(fpts)} stroke={pc} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#ah-y)" opacity={0.7} />;
                  }
                  return <line x1={drawStart.x} y1={drawStart.y} x2={drawCursor.x} y2={drawCursor.y} stroke={pc} strokeWidth={2} strokeDasharray="6 3" markerEnd="url(#ah-y)" opacity={0.7} />;
                }
                if (tool === "dashed") {
                  if (fpts.length >= 2) {
                    return <path d={pointsToPath(fpts)} stroke={pc} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="9 5" markerEnd="url(#ah-g)" opacity={0.7} />;
                  }
                  return <line x1={drawStart.x} y1={drawStart.y} x2={drawCursor.x} y2={drawCursor.y} stroke={pc} strokeWidth={2} strokeDasharray="9 5" markerEnd="url(#ah-g)" opacity={0.7} />;
                }
                if (tool === "circle") {
                  const r = Math.sqrt((drawCursor.x - drawStart.x) ** 2 + (drawCursor.y - drawStart.y) ** 2);
                  return <circle cx={drawStart.x} cy={drawStart.y} r={r} stroke={pc} strokeWidth={2} fill="none" opacity={0.7} />;
                }
                return <rect x={Math.min(drawStart.x, drawCursor.x)} y={Math.min(drawStart.y, drawCursor.y)} width={Math.abs(drawCursor.x - drawStart.x)} height={Math.abs(drawCursor.y - drawStart.y)} stroke={pc} strokeWidth={2} fill={tool === "zone" ? zoneColor : "none"} opacity={0.7} />;
              })()}
              {displayPlayers.map(p => (
                <PlayerMarker key={p.id} player={p}
                  isSelected={p.id === selectedPlayerId && !isPlaying}
                  onPointerDown={e => handlePlayerPointerDown(e, p.id)}
                  interactive={!isPlaying && (tool === "select" || tool === "erase")} />
              ))}
            </svg>
          </div>
          {/* Exit fullscreen button — only shown when in fullscreen mode */}
          {isFullscreen && (
            <button
              onClick={toggleFullscreen}
              title="Avsluta helskärm (Esc)"
              className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-black/50 text-white/80 hover:bg-black/70 transition-colors"
            >
              ⛶ Avsluta
            </button>
          )}
          {!isFullscreen && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-red-600 inline-block" />Hemmalag</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-blue-600 inline-block" />Bortalag</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-orange-500 inline-block" />Boll</span>
              <span className="flex items-center gap-1.5"><span className="w-5 h-0.5 bg-yellow-400 inline-block" />Rörelse</span>
              <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-lime-500" />Pass</span>
            </div>
          )}
        </div>

        {/* Right panel */}
        {showRight && (
          <div className="w-full xl:w-72 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex border-b border-slate-100">
                {(["players", "tactics", "notes"] as const).map(tab => (
                  <button key={tab} onClick={() => setRightTab(tab)}
                    className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${rightTab === tab ? "text-orange-600 border-b-2 border-orange-500 bg-orange-50" : "text-slate-500 hover:text-slate-700"}`}>
                    {tab === "players" ? "Spelare" : tab === "tactics" ? "💾 Taktiker" : "📝 Noter"}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-4">

                {rightTab === "players" && (
                  <>
                    <div>
                      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">🔴 Hemmalag</h3>
                      <div className="space-y-1.5">
                        {(steps[0]?.players ?? []).filter(p => p.team === "home").map(p => {
                          const live = currentStep?.players.find(cp => cp.id === p.id);
                          return (
                            <div key={p.id} className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-red-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{p.number}</span>
                              <input value={live?.name ?? ""} onChange={e => updatePlayerInfo(p.id, { name: e.target.value })} placeholder={`Spelare ${p.number}`}
                                className="flex-1 text-xs px-1.5 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 min-w-0" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">🔵 Bortalag</h3>
                      <div className="space-y-1">
                        {(steps[0]?.players ?? []).filter(p => p.team === "away").map(p => (
                          <div key={p.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">{p.number}</span>
                            <span>Spelare {p.number}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {selectedPlayer && selectedPlayer.team !== "ball" && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <h3 className="text-xs font-bold text-slate-700 mb-1">
                          {selectedPlayer.team === "home" ? "🔴" : "🔵"} #{selectedPlayer.number}{selectedPlayer.name ? ` – ${selectedPlayer.name}` : ""}
                        </h3>
                        <p className="text-xs text-slate-500 mb-2">Taktisk roll:</p>
                        <div className="flex flex-wrap gap-1">
                          {TACTICAL_ROLES.map(role => (
                            <button key={role} onClick={() => updatePlayerInfo(selectedPlayer.id, { role })}
                              className={`text-xs px-2 py-0.5 rounded-lg font-medium transition-colors ${selectedPlayer.role === role ? "bg-orange-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-orange-50 hover:border-orange-300"}`}>
                              {role}
                            </button>
                          ))}
                          {selectedPlayer.role && (
                            <button onClick={() => updatePlayerInfo(selectedPlayer.id, { role: undefined })}
                              className="text-xs px-2 py-0.5 rounded-lg font-medium bg-red-50 border border-red-200 text-red-600 hover:bg-red-100">
                              ✕ Rensa roll
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {!selectedPlayer && (
                      <p className="text-xs text-slate-400 text-center py-1">Klicka på en spelare (välj-läge) för att tilldela roll</p>
                    )}
                  </>
                )}

                {rightTab === "tactics" && (
                  <>
                    <div>
                      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Spara taktik</h3>
                      <div className="flex gap-2">
                        <input value={tacticName} onChange={e => setTacticName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveTactic()} placeholder="Namn på taktiken…"
                          className="flex-1 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 min-w-0" />
                        <button onClick={saveTactic} disabled={!tacticName.trim()}
                          className="px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors shrink-0">
                          💾
                        </button>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Sparade ({savedTactics.length})</h3>
                      {savedTactics.length === 0 ? (
                        <p className="text-xs text-slate-400">Inga sparade taktiker ännu.</p>
                      ) : (
                        <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                          {savedTactics.map(t => (
                            <li key={t.id} className="flex items-center gap-1.5 bg-slate-50 rounded-xl px-2.5 py-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-slate-800 truncate">{t.name}</p>
                                <p className="text-xs text-slate-400">{t.steps?.length ?? 0} steg</p>
                              </div>
                              <button onClick={() => loadTactic(t)} className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 transition-colors shrink-0">Ladda</button>
                              <button onClick={() => deleteTactic(t.id)} className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 transition-colors shrink-0">✕</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}

                {rightTab === "notes" && (
                  <div>
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">📝 Tränarinstruktioner</h3>
                    <textarea value={coachNotes} onChange={e => setCoachNotes(e.target.value)} onBlur={() => pushLive()}
                      placeholder={"Skriv taktiska instruktioner här…\nEx: Kör Give-and-Go på höger sida.\n#4 sätter skärm vid frisparkslinjen."}
                      rows={10} className="w-full text-xs px-2.5 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none leading-relaxed" />
                    <p className="text-xs text-slate-400 mt-1">Sparas med taktiken.</p>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            <span className="text-xs font-bold text-slate-500 shrink-0">Steg:</span>
            {steps.map((step, idx) => (
              <div key={step.id} className="relative group">
                <button
                  onClick={() => { if (!isPlaying) { setCurrentStepIdx(idx); setSelectedPlayerId(null); } }}
                  disabled={isPlaying}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${idx === currentStepIdx && !isPlaying ? "bg-orange-500 text-white ring-2 ring-offset-1 ring-orange-300" : isPlaying && idx === playStepIdx ? "bg-orange-300 text-white animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200"} disabled:opacity-70`}>
                  {step.label}
                </button>
                {steps.length > 1 && !isPlaying && (
                  <button onClick={() => removeStep(idx)} title="Ta bort steg"
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs leading-none items-center justify-center hidden group-hover:flex">
                    ×
                  </button>
                )}
              </div>
            ))}
            <button onClick={addStep} disabled={isPlaying}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors border border-dashed border-slate-300 disabled:opacity-40">
              + Nytt steg
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {steps.length < 2 && !isPlaying && <span className="text-xs text-slate-400 hidden sm:block">Lägg till 2+ steg</span>}
            <button onClick={isPlaying ? stopAnimation : playAnimation} disabled={!isPlaying && steps.length < 2}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all ${isPlaying ? "bg-red-500 hover:bg-red-600" : "bg-green-600 hover:bg-green-700 disabled:opacity-40"}`}>
              {isPlaying ? "⏹ Stopp" : "▶ Spela upp"}
            </button>
            <button onClick={exportPng} disabled={isPlaying} title="Exportera aktuellt steg som PNG"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors disabled:opacity-40">
              🖼 Exportera
            </button>
          </div>
        </div>
        {isPlaying && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-orange-500 rounded-full transition-none"
                style={{ width: `${((playStepIdx + playProgress) / Math.max(steps.length - 1, 1)) * 100}%` }} />
            </div>
            <span className="text-xs text-orange-600 font-medium animate-pulse shrink-0">
              🎦 Steg {playStepIdx + 1} → {playStepIdx + 2}
            </span>
          </div>
        )}
      </div>

      {!isPlaying && steps.length >= 2 && (
        <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 font-medium">
          💡 Tryck <strong>▶ Spela upp</strong> för att animera spelarna från steg till steg.
          {isOnline && " Animationen synkas i realtid med alla i laget."}
        </div>
      )}
    </div>
  );
}
