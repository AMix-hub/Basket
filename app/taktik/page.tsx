"use client";

import { useState, useRef, useEffect, useCallback } from "react";

/* ─── Types ─────────────────────────────────────────────────── */
interface Player {
  id: string;
  type: "O" | "X";
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

interface Tactic {
  id: string;
  name: string;
  players: Player[];
  arrows: Arrow[];
  createdAt: string;
}

type Tool = "select" | "addO" | "addX" | "arrow" | "erase";

/* ─── Court dimensions ────────────────────────────────────────── */
const W = 380;
const H = 510;

/* ─── Basketball court SVG ──────────────────────────────────── */
function BasketballCourt() {
  const lineProps = {
    stroke: "rgba(255,255,255,0.85)",
    strokeWidth: 2,
    fill: "none",
  };

  const topThreePoint = `M 15 150 A 185 185 0 0 1 365 150`;
  const botThreePoint = `M 365 360 A 185 185 0 0 1 15 360`;

  return (
    <g>
      {/* Wood floor */}
      <rect x={0} y={0} width={W} height={H} fill="#c87428" />
      {/* Court boundary */}
      <rect x={10} y={10} width={360} height={490} {...lineProps} />
      {/* Half-court line */}
      <line x1={10} y1={255} x2={370} y2={255} {...lineProps} />
      {/* Center circle */}
      <circle cx={190} cy={255} r={42} {...lineProps} />
      <circle cx={190} cy={255} r={3} fill="rgba(255,255,255,0.85)" />

      {/* ── TOP BASKET ── */}
      <rect x={110} y={10} width={160} height={165} {...lineProps} fill="rgba(255,255,255,0.08)" />
      <line x1={110} y1={175} x2={270} y2={175} {...lineProps} />
      <path d={`M 110 175 A 80 80 0 0 0 270 175`} {...lineProps} />
      <path d={`M 165 10 A 40 40 0 0 0 215 10`} {...lineProps} />
      <line x1={155} y1={32} x2={225} y2={32} stroke="rgba(255,255,255,0.85)" strokeWidth={3} />
      <circle cx={190} cy={45} r={14} {...lineProps} />
      <path d={topThreePoint} {...lineProps} />
      <line x1={15} y1={10} x2={15} y2={150} {...lineProps} />
      <line x1={365} y1={10} x2={365} y2={150} {...lineProps} />

      {/* ── BOTTOM BASKET (mirror) ── */}
      <rect x={110} y={335} width={160} height={165} {...lineProps} fill="rgba(255,255,255,0.08)" />
      <line x1={110} y1={335} x2={270} y2={335} {...lineProps} />
      <path d={`M 110 335 A 80 80 0 0 1 270 335`} {...lineProps} />
      <path d={`M 165 500 A 40 40 0 0 1 215 500`} {...lineProps} />
      <line x1={155} y1={478} x2={225} y2={478} stroke="rgba(255,255,255,0.85)" strokeWidth={3} />
      <circle cx={190} cy={465} r={14} {...lineProps} />
      <path d={botThreePoint} {...lineProps} />
      <line x1={15} y1={500} x2={15} y2={360} {...lineProps} />
      <line x1={365} y1={500} x2={365} y2={360} {...lineProps} />
    </g>
  );
}

/* ─── Arrow head marker ─────────────────────────────────────── */
function ArrowMarker() {
  return (
    <defs>
      <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0, 8 3, 0 6" fill="#facc15" />
      </marker>
    </defs>
  );
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function TaktikPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [tactics, setTactics] = useState<Tactic[]>([]);
  const [tacticName, setTacticName] = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("basketball_tactics");
    if (saved) setTactics(JSON.parse(saved));
  }, []);

  const getSVGCoords = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return { x: 0, y: 0 };
      const rect = svg.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    },
    []
  );

  const handleSVGPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const coords = getSVGCoords(e.clientX, e.clientY);
    if (tool === "addO" || tool === "addX") {
      setPlayers((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: tool === "addO" ? "O" : "X",
          x: coords.x,
          y: coords.y,
        },
      ]);
    } else if (tool === "arrow") {
      setDrawStart(coords);
      setCursorPos(coords);
    }
  };

  const handleSVGPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === "arrow" && drawStart) {
      const coords = getSVGCoords(e.clientX, e.clientY);
      setCursorPos(coords);
    }
    if (tool === "select" && draggingId) {
      const coords = getSVGCoords(e.clientX, e.clientY);
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === draggingId ? { ...p, x: coords.x, y: coords.y } : p
        )
      );
    }
  };

  const handleSVGPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool === "arrow" && drawStart) {
      const coords = getSVGCoords(e.clientX, e.clientY);
      const dx = coords.x - drawStart.x;
      const dy = coords.y - drawStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > 10) {
        setArrows((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            x1: drawStart.x,
            y1: drawStart.y,
            x2: coords.x,
            y2: coords.y,
          },
        ]);
      }
      setDrawStart(null);
      setCursorPos(null);
    }
    setDraggingId(null);
  };

  const handlePlayerPointerDown = (e: React.PointerEvent, id: string) => {
    if (tool === "select") {
      e.stopPropagation();
      setDraggingId(id);
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } else if (tool === "erase") {
      e.stopPropagation();
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const handleArrowClick = (id: string) => {
    if (tool === "erase") {
      setArrows((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const saveTactic = () => {
    if (!tacticName.trim()) return;
    const newTactic: Tactic = {
      id: crypto.randomUUID(),
      name: tacticName.trim(),
      players,
      arrows,
      createdAt: new Date().toISOString(),
    };
    const updated = [newTactic, ...tactics];
    setTactics(updated);
    localStorage.setItem("basketball_tactics", JSON.stringify(updated));
    setTacticName("");
  };

  const loadTactic = (t: Tactic) => {
    setPlayers(t.players);
    setArrows(t.arrows);
    setShowPanel(false);
  };

  const deleteTactic = (id: string) => {
    const updated = tactics.filter((t) => t.id !== id);
    setTactics(updated);
    localStorage.setItem("basketball_tactics", JSON.stringify(updated));
  };

  const clearBoard = () => {
    setPlayers([]);
    setArrows([]);
  };

  const toolConfig: { id: Tool; label: string; color: string }[] = [
    { id: "select", label: "↖ Flytta", color: "bg-slate-700" },
    { id: "addO", label: "O Anfall", color: "bg-emerald-600" },
    { id: "addX", label: "X Försvar", color: "bg-red-600" },
    { id: "arrow", label: "→ Pil", color: "bg-yellow-500" },
    { id: "erase", label: "✕ Radera", color: "bg-slate-500" },
  ];

  const cursorClass =
    tool === "addO" || tool === "addX" || tool === "arrow"
      ? "cursor-crosshair"
      : tool === "erase"
      ? "cursor-pointer"
      : "cursor-default";

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">🏀</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Interaktiv Taktiktavla
          </h1>
        </div>
        <p className="text-slate-500 text-sm">
          Placera spelare, rita rörelsepillar och spara dina taktiker.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {toolConfig.map(({ id, label, color }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            className={`px-3 py-2 rounded-xl text-sm font-semibold text-white transition-all ${color} ${
              tool === id
                ? "ring-2 ring-offset-2 ring-orange-400 scale-105"
                : "opacity-75 hover:opacity-100"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={clearBoard}
          className="px-3 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors ml-auto"
        >
          🗑 Rensa
        </button>
        <button
          onClick={() => setShowPanel((s) => !s)}
          className="px-3 py-2 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors"
        >
          💾 Taktiker ({tactics.length})
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Court */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${W} ${H}`}
              className={`w-full select-none touch-none ${cursorClass}`}
              style={{ maxHeight: "70vh" }}
              onPointerDown={handleSVGPointerDown}
              onPointerMove={handleSVGPointerMove}
              onPointerUp={handleSVGPointerUp}
            >
              <ArrowMarker />
              <BasketballCourt />

              {/* Arrows */}
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
                  className={tool === "erase" ? "cursor-pointer" : ""}
                  onClick={() => handleArrowClick(a.id)}
                />
              ))}

              {/* Live arrow preview */}
              {tool === "arrow" && drawStart && cursorPos && (
                <line
                  x1={drawStart.x}
                  y1={drawStart.y}
                  x2={cursorPos.x}
                  y2={cursorPos.y}
                  stroke="#facc15"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  markerEnd="url(#arrowhead)"
                />
              )}

              {/* Players */}
              {players.map((p) => (
                <g
                  key={p.id}
                  transform={`translate(${p.x},${p.y})`}
                  onPointerDown={(e) => handlePlayerPointerDown(e, p.id)}
                  className="cursor-grab active:cursor-grabbing"
                  style={{ touchAction: "none" }}
                >
                  <circle
                    r={18}
                    fill={p.type === "O" ? "#16a34a" : "#dc2626"}
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
                    {p.type}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 inline-block" />
              O = Anfallare
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-red-600 inline-block" />
              X = Försvarare
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-0.5 bg-yellow-400 inline-block" />
              Pil = Rörelse/Pass
            </div>
          </div>
        </div>

        {/* Save / Load panel */}
        {showPanel && (
          <div className="w-full lg:w-72 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <h2 className="font-bold text-slate-900 mb-3">Spara taktik</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={tacticName}
                  onChange={(e) => setTacticName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveTactic()}
                  placeholder="Namn på taktiken..."
                  className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button
                  onClick={saveTactic}
                  disabled={!tacticName.trim()}
                  className="px-3 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 transition-colors"
                >
                  💾
                </button>
              </div>

              <h3 className="font-semibold text-slate-700 text-sm mb-2">
                Sparade taktiker
              </h3>
              {tactics.length === 0 ? (
                <p className="text-slate-400 text-sm">
                  Inga sparade taktiker ännu.
                </p>
              ) : (
                <ul className="space-y-2">
                  {tactics.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-800 truncate">
                          {t.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {t.players.length} spelare · {t.arrows.length} pilar
                        </p>
                      </div>
                      <button
                        onClick={() => loadTactic(t)}
                        className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 transition-colors"
                      >
                        Ladda
                      </button>
                      <button
                        onClick={() => deleteTactic(t.id)}
                        className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 transition-colors"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
