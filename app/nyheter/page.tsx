"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import type { NewsItem } from "../api/nyheter/route";

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function NyheterPage() {
  const { user, getMyTeam } = useAuth();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);

  const team = getMyTeam();

  // Resolve the club website URL from the user (admin) or their team (others)
  useEffect(() => {
    const url = user?.clubWebsiteUrl ?? team?.clubWebsiteUrl ?? null;
    setWebsiteUrl(url);
  }, [user, team]);

  const fetchNews = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/nyheter?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kunde inte hämta nyheter.");
        setItems([]);
      } else {
        setItems(data.items ?? []);
        if ((data.items ?? []).length === 0) {
          setError("Inga nyheter hittades på föreningens webbplats.");
        }
      }
    } catch {
      setError("Nätverksfel – kontrollera din anslutning.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (websiteUrl) {
      fetchNews(websiteUrl);
    }
  }, [websiteUrl, fetchNews]);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-slate-400">Du måste vara inloggad för att se nyheter.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight mb-1">
          📰 Nyheter
        </h1>
        {websiteUrl ? (
          <p className="text-slate-400 text-sm">
            Hämtat från{" "}
            <a
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 hover:underline"
            >
              {websiteUrl}
            </a>
          </p>
        ) : (
          <p className="text-slate-400 text-sm">
            Ingen webbplats konfigurerad för föreningen.
          </p>
        )}
      </div>

      {/* No website configured */}
      {!websiteUrl && (
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-4">🌐</div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
            Ingen webbplats inställd
          </h2>
          <p className="text-slate-400 text-sm mb-4">
            För att visa nyheter från din förening behöver en administratör ange
            föreningens webbplatsadress i adminpanelen.
          </p>
          {user.roles.includes("admin") && (
            <Link
              href="/admin"
              className="inline-block px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Gå till adminpanelen
            </Link>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Hämtar nyheter…</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && websiteUrl && (
        <div className="bg-red-900/30 border border-red-700 rounded-2xl p-6 text-center">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <button
            onClick={() => fetchNews(websiteUrl)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Försök igen
          </button>
        </div>
      )}

      {/* News list */}
      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item, i) => (
            <article
              key={item.link ? `${item.link}-${item.pubDate}` : i}
              className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden hover:border-gray-400 dark:hover:border-slate-500 transition-colors"
            >
              {item.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
              <div className="p-5">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 leading-snug">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-orange-400 transition-colors"
                    >
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </h2>
                {item.pubDate && (
                  <p className="text-xs text-slate-500 mb-2">
                    {formatDate(item.pubDate)}
                  </p>
                )}
                {item.description && (
                  <p className="text-sm text-slate-400 line-clamp-3">
                    {item.description}
                  </p>
                )}
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    Läs mer →
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Reload button */}
      {!loading && websiteUrl && items.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={() => fetchNews(websiteUrl)}
            className="px-4 py-2 text-sm font-semibold bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-xl transition-colors"
          >
            🔄 Uppdatera
          </button>
        </div>
      )}
    </div>
  );
}
