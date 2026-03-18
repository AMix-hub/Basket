"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

type DrawTool = "pen" | "arrow" | "circle" | "rect" | "text";
type DrawColor = "#ef4444" | "#f97316" | "#22c55e" | "#3b82f6" | "#ffffff" | "#000000";

interface Point {
  x: number;
  y: number;
}

interface DrawShape {
  id: string;
  tool: DrawTool;
  color: DrawColor;
  lineWidth: number;
  points?: Point[];   // for pen
  start?: Point;      // for arrow, circle, rect
  end?: Point;        // for arrow, circle, rect
  text?: string;      // for text
}

const TOOLS: { id: DrawTool; label: string; icon: string }[] = [
  { id: "pen", label: "Penna", icon: "✏️" },
  { id: "arrow", label: "Pil", icon: "➡️" },
  { id: "circle", label: "Cirkel", icon: "⭕" },
  { id: "rect", label: "Rektangel", icon: "▭" },
  { id: "text", label: "Text", icon: "T" },
];

const COLORS: DrawColor[] = ["#ef4444", "#f97316", "#22c55e", "#3b82f6", "#ffffff", "#000000"];
const COLOR_LABELS: Record<DrawColor, string> = {
  "#ef4444": "Röd",
  "#f97316": "Orange",
  "#22c55e": "Grön",
  "#3b82f6": "Blå",
  "#ffffff": "Vit",
  "#000000": "Svart",
};

function drawShapeOnCanvas(ctx: CanvasRenderingContext2D, shape: DrawShape) {
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (shape.tool === "pen" && shape.points && shape.points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    ctx.stroke();
  } else if (shape.tool === "arrow" && shape.start && shape.end) {
    const { start, end } = shape;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const headLen = Math.max(12, shape.lineWidth * 4);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  } else if (shape.tool === "circle" && shape.start && shape.end) {
    const cx = (shape.start.x + shape.end.x) / 2;
    const cy = (shape.start.y + shape.end.y) / 2;
    const rx = Math.abs(shape.end.x - shape.start.x) / 2;
    const ry = Math.abs(shape.end.y - shape.start.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
    ctx.stroke();
  } else if (shape.tool === "rect" && shape.start && shape.end) {
    const x = Math.min(shape.start.x, shape.end.x);
    const y = Math.min(shape.start.y, shape.end.y);
    const w = Math.abs(shape.end.x - shape.start.x);
    const h = Math.abs(shape.end.y - shape.start.y);
    ctx.strokeRect(x, y, w, h);
  } else if (shape.tool === "text" && shape.start && shape.text) {
    ctx.font = `bold ${Math.max(14, shape.lineWidth * 8)}px sans-serif`;
    ctx.fillText(shape.text, shape.start.x, shape.start.y);
  }
}

export default function VideoOverlayPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 360 });
  const [shapes, setShapes] = useState<DrawShape[]>([]);
  const [currentShape, setCurrentShape] = useState<DrawShape | null>(null);
  const [activeTool, setActiveTool] = useState<DrawTool>("pen");
  const [activeColor, setActiveColor] = useState<DrawColor>("#ef4444");
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pendingTextPos, setPendingTextPos] = useState<Point | null>(null);
  const [textInput, setTextInput] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    shapes.forEach((s) => drawShapeOnCanvas(ctx, s));
    if (currentShape) drawShapeOnCanvas(ctx, currentShape);
  }, [shapes, currentShape]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pt = getCanvasPoint(e);
    if (activeTool === "text") {
      setPendingTextPos(pt);
      setTextInput("");
      return;
    }
    setIsDrawing(true);
    const shape: DrawShape = {
      id: crypto.randomUUID(),
      tool: activeTool,
      color: activeColor,
      lineWidth,
      ...(activeTool === "pen" ? { points: [pt] } : { start: pt, end: pt }),
    };
    setCurrentShape(shape);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentShape) return;
    e.preventDefault();
    const pt = getCanvasPoint(e);
    setCurrentShape((prev) => {
      if (!prev) return null;
      if (prev.tool === "pen") {
        return { ...prev, points: [...(prev.points ?? []), pt] };
      }
      return { ...prev, end: pt };
    });
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentShape) return;
    setIsDrawing(false);
    setShapes((prev) => [...prev, currentShape]);
    setCurrentShape(null);
  };

  const addText = () => {
    if (!pendingTextPos || !textInput.trim()) {
      setPendingTextPos(null);
      return;
    }
    const shape: DrawShape = {
      id: crypto.randomUUID(),
      tool: "text",
      color: activeColor,
      lineWidth,
      start: pendingTextPos,
      text: textInput.trim(),
    };
    setShapes((prev) => [...prev, shape]);
    setPendingTextPos(null);
    setTextInput("");
  };

  const undoLast = () => {
    setShapes((prev) => prev.slice(0, -1));
  };

  const clearAll = () => {
    setShapes([]);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setShapes([]);
  };

  const handleVideoLoaded = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setVideoDimensions({ width: video.videoWidth, height: video.videoHeight });
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const t = parseFloat(e.target.value);
    video.currentTime = t;
    setCurrentTime(t);
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const saveAnnotatedFrame = () => {
    const video = videoRef.current;
    const drawCanvas = canvasRef.current;
    if (!video || !drawCanvas) return;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = videoDimensions.width;
    exportCanvas.height = videoDimensions.height;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(drawCanvas, 0, 0);
    const link = document.createElement("a");
    link.download = `analys-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/videor" className="text-slate-400 hover:text-slate-600 text-sm">← Tillbaka</Link>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🎬</span>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Video-overlay – Matchanalys
            </h1>
          </div>
          <p className="text-slate-500 text-sm">
            Ladda upp ett matchklipp och rita direkt på videon för att visa positioneringsfel och taktiska lärdomar.
          </p>
        </div>
        <button
          onClick={() => setShowHelp((s) => !s)}
          className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium transition-colors"
        >
          {showHelp ? "▼ Dölj hjälp" : "▸ Visa hjälp"}
        </button>
      </div>

      {showHelp && (
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-2xl p-4 mb-6 text-sm text-blue-800 space-y-1.5">
          <p className="font-semibold">Hur du använder video-overlay:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Ladda upp ett videoklipp från din enhet (MP4, MOV, WebM).</li>
            <li>Pausa videon på den bild du vill analysera.</li>
            <li>Välj verktyg (penna, pil, cirkel, rektangel eller text) och färg.</li>
            <li>Rita direkt på videon för att markera positioner, rörelser eller fel.</li>
            <li>Klicka &ldquo;Spara stillbild&rdquo; för att exportera den annoterade bilden som PNG.</li>
          </ol>
        </div>
      )}

      {/* Upload area */}
      {!videoSrc && (
        <div className="bg-slate-800 rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center mb-6">
          <p className="text-5xl mb-4">📹</p>
          <p className="text-slate-600 font-semibold mb-2">Ladda upp ett videoklipp</p>
          <p className="text-slate-400 text-sm mb-6">Stödjer MP4, MOV, WebM. Videon stannar på din enhet.</p>
          <label className="inline-block cursor-pointer px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-sm transition-colors">
            Välj videofil
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={handleVideoUpload}
            />
          </label>
        </div>
      )}

      {videoSrc && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Tools */}
              <div className="flex gap-1">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTool(t.id)}
                    title={t.label}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                      activeTool === t.id
                        ? "bg-orange-500 text-white shadow"
                        : "bg-slate-700 text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    {t.icon}
                  </button>
                ))}
              </div>

              <div className="w-px h-8 bg-slate-200" />

              {/* Colors */}
              <div className="flex gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveColor(c)}
                    title={COLOR_LABELS[c]}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${
                      activeColor === c
                        ? "border-orange-500 scale-110 shadow"
                        : "border-transparent hover:border-slate-300"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <div className="w-px h-8 bg-slate-200" />

              {/* Line width */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Tjocklek:</span>
                <input
                  type="range"
                  min={1}
                  max={8}
                  value={lineWidth}
                  onChange={(e) => setLineWidth(Number(e.target.value))}
                  className="w-20 accent-orange-500"
                />
                <span className="text-xs font-bold text-slate-600">{lineWidth}</span>
              </div>

              <div className="flex gap-2 ml-auto">
                <button
                  onClick={undoLast}
                  disabled={shapes.length === 0}
                  className="px-3 py-1.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-600 rounded-xl transition-colors"
                >
                  ↩ Ångra
                </button>
                <button
                  onClick={clearAll}
                  disabled={shapes.length === 0}
                  className="px-3 py-1.5 text-sm font-semibold bg-red-900/30 hover:bg-red-100 disabled:opacity-40 text-red-600 rounded-xl transition-colors"
                >
                  🗑 Rensa
                </button>
                <button
                  onClick={saveAnnotatedFrame}
                  className="px-3 py-1.5 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors"
                >
                  💾 Spara stillbild
                </button>
                <label className="px-3 py-1.5 text-sm font-semibold bg-slate-600 hover:bg-slate-700 text-white rounded-xl transition-colors cursor-pointer">
                  📹 Byt video
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleVideoUpload}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Video + canvas overlay */}
          <div
            ref={containerRef}
            className="relative bg-black rounded-2xl overflow-hidden select-none"
            style={{ aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}` }}
          >
            <video
              ref={videoRef}
              src={videoSrc}
              className="absolute inset-0 w-full h-full object-contain"
              onLoadedMetadata={handleVideoLoaded}
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
              onEnded={() => setIsPlaying(false)}
              playsInline
            />
            <canvas
              ref={canvasRef}
              width={videoDimensions.width}
              height={videoDimensions.height}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ cursor: activeTool === "text" ? "text" : "crosshair", touchAction: "none" }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />

            {/* Text input overlay */}
            {pendingTextPos && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-10">
                <div className="bg-[#1e293b] rounded-xl shadow-xl border border-slate-700 p-4 w-64">
                  <p className="text-sm font-semibold text-slate-300 mb-2">Skriv text på videon</p>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addText(); if (e.key === "Escape") setPendingTextPos(null); }}
                    placeholder="T.ex. Fel position"
                    autoFocus
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 mb-3"
                  />
                  <div className="flex gap-2">
                    <button onClick={addText} className="flex-1 py-1.5 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600">Lägg till</button>
                    <button onClick={() => setPendingTextPos(null)} className="flex-1 py-1.5 bg-slate-100 text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-200">Avbryt</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Video controls */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="w-9 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-lg transition-colors shrink-0"
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <span className="text-xs text-slate-500 font-mono shrink-0">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 accent-orange-500"
              />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              💡 Tips: Pausa på en specifik bild och rita sedan dina annotationer på videon.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
