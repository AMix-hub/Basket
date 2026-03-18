"use client";

import { useState } from "react";
import Link from "next/link";

interface VideoEntry {
  id: string;
  title: string;
  url: string;
  category: string;
  addedAt: string;
}

const VIDEOS_KEY = "basketball_videos";

const CATEGORIES = [
  "Alla",
  "Dribbling",
  "Skott",
  "Passning",
  "Försvar",
  "Taktik",
  "Uppvärmning",
  "Övrigt",
];

const YOUTUBE_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("?")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (YOUTUBE_HOSTNAMES.has(u.hostname)) {
      const id = u.searchParams.get("v");
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
  } catch {
    // not a valid URL
  }
  return null;
}

function YouTubeEmbed({ videoId }: { videoId: string }) {
  return (
    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
      <iframe
        className="absolute inset-0 w-full h-full rounded-xl"
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        // x-webkit-airplay enables AirPlay controls in Safari/iOS for the embedded player
        {...{ "x-webkit-airplay": "allow" }}
        allowFullScreen
      />
    </div>
  );
}

export default function VideorPage() {
  const [videos, setVideos] = useState<VideoEntry[]>(() => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(VIDEOS_KEY);
    return saved ? (JSON.parse(saved) as VideoEntry[]) : [];
  });
  const [activeCategory, setActiveCategory] = useState("Alla");

  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newCategory, setNewCategory] = useState("Övrigt");
  const [urlError, setUrlError] = useState("");

  const saveVideos = (updated: VideoEntry[]) => {
    setVideos(updated);
    localStorage.setItem(VIDEOS_KEY, JSON.stringify(updated));
  };

  const addVideo = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError("");
    const videoId = getYouTubeId(newUrl.trim());
    if (!videoId) {
      setUrlError("Ogiltig YouTube-länk. Klistra in en länk från youtube.com eller youtu.be.");
      return;
    }
    const entry: VideoEntry = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      url: newUrl.trim(),
      category: newCategory,
      addedAt: new Date().toISOString(),
    };
    saveVideos([entry, ...videos]);
    setNewTitle("");
    setNewUrl("");
    setNewCategory("Övrigt");
    setShowForm(false);
  };

  const deleteVideo = (id: string) => {
    saveVideos(videos.filter((v) => v.id !== id));
  };

  const filtered =
    activeCategory === "Alla"
      ? videos
      : videos.filter((v) => v.category === activeCategory);

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🎬</span>
            <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight">
              Videobibliotek
            </h1>
          </div>
          <p className="text-slate-500 text-sm">
            Bädda in YouTube-videor för övningar och taktiker.
          </p>
          {/* AirPlay / Chromecast hint */}
          <p className="text-slate-400 text-xs mt-1">
            📺 Visa video på TV via{" "}
            <span className="font-medium text-slate-500">
              AirPlay
            </span>{" "}
            (iOS/macOS: Kontrollcenter → Skärmspegling) eller{" "}
            <span className="font-medium text-slate-500">
              Chromecast
            </span>{" "}
            (Chrome: cast-ikonen i adressfältet).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href="/videor/overlay"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            🖊 Matchanalys / Overlay
          </Link>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
          >
            + Lägg till video
          </button>
        </div>
      </div>

      {/* Add video form */}
      {showForm && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 mb-6">
          <h2 className="font-bold text-slate-100 mb-4">Lägg till YouTube-video</h2>
          <form onSubmit={addVideo} className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Titel
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="T.ex. Dribblingövning med konor"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                YouTube-länk
              </label>
              <input
                type="url"
                required
                value={newUrl}
                onChange={(e) => {
                  setNewUrl(e.target.value);
                  setUrlError("");
                }}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              {urlError && (
                <p className="text-red-600 text-xs mt-1">{urlError}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-1">
                Kategori
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                {CATEGORIES.filter((c) => c !== "Alla").map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                Spara
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setUrlError("");
                }}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
              >
                Avbryt
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all ${
              activeCategory === cat
                ? "bg-orange-500 text-white"
                : "bg-slate-700 text-slate-300 hover:bg-slate-200"
            }`}
          >
            {cat}
            {cat !== "Alla" && (
              <span className="ml-1 text-xs opacity-70">
                ({videos.filter((v) => v.category === cat).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Videos grid */}
      {filtered.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-4xl mb-3">🎬</p>
          <p className="text-slate-500 text-sm">
            {videos.length === 0
              ? "Inga videor sparade ännu. Klicka på \"Lägg till video\" för att komma igång."
              : "Inga videor i den valda kategorin."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => {
            const videoId = getYouTubeId(v.url);
            return (
              <div
                key={v.id}
                className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden"
              >
                {videoId ? (
                  <YouTubeEmbed videoId={videoId} />
                ) : (
                  <div className="bg-slate-100 h-40 flex items-center justify-center text-slate-400 text-sm">
                    Ogiltig video-URL
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-200 text-sm truncate">
                        {v.title}
                      </p>
                      <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
                        {v.category}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteVideo(v.id)}
                      className="shrink-0 text-xs px-2 py-1 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-100 transition-colors font-medium"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
