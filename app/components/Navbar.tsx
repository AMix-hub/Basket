"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../context/AuthContext";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { useTheme } from "../context/ThemeContext";
import { roleEmoji } from "../../lib/roleLabels";
import { getSport } from "../../lib/sports";

interface NavItem {
  href: string;
  label: string;
  restrictedRoles?: UserRole[];
  parentOnly?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    id: "schema",
    label: "📅 Schema",
    items: [
      { href: "/kalender",  label: "📅 Kalender" },
      { href: "/matcher",   label: "⚽ Matcher" },
      { href: "/cup",       label: "🏆 Cuper" },
    ],
  },
  {
    id: "traning",
    label: "🏋 Träning",
    items: [
      { href: "/traningsdatabas", label: "💪 Träningsdatabas" },
      { href: "/mallar",          label: "📋 Mallar",    restrictedRoles: ["player", "parent"] },
      { href: "/utrustning",      label: "🎒 Utrustning", restrictedRoles: ["player", "parent"] },
    ],
  },
  {
    id: "trupp",
    label: "👥 Trupp",
    items: [
      { href: "/spelare",    label: "🏀 Spelare" },
      { href: "/lag",        label: "🏟 Laget" },
      { href: "/utveckling", label: "📈 Spelarutveckling" },
      { href: "/statistik",  label: "📊 Statistik",  restrictedRoles: ["player", "parent"] },
      { href: "/registret",  label: "👥 Registret",  restrictedRoles: ["player", "parent"] },
      { href: "/familj",     label: "👪 Min sida",   parentOnly: true },
    ],
  },
  {
    id: "klubb",
    label: "📣 Klubb",
    items: [
      { href: "/nyheter",     label: "📰 Nyheter" },
      { href: "/mal",         label: "🎯 Säsongsmål" },
      { href: "/videor",      label: "🎬 Videor" },
      { href: "/dokument",    label: "📁 Dokument" },
      { href: "/betalningar", label: "💰 Betalningar", restrictedRoles: ["player", "parent"] },
    ],
  },
];

const adminLinks = [
  { href: "/admin",    label: "🏛 Adminpanel" },
  { href: "/registret", label: "👥 Registret" },
  { href: "/dev",      label: "🛠 Utveckling" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, getMyTeam } = useAuth();
  const unread = useUnreadCount();

  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const sport = getSport(user?.sport ?? "basket");
  const team = getMyTeam();
  const clubLogoUrl = user?.clubLogoUrl ?? team?.clubLogoUrl ?? null;
  const clubName    = user?.clubName    ?? team?.clubName    ?? null;

  const isAdmin  = user?.roles.includes("admin")  ?? false;
  const isParent = user?.roles.includes("parent") ?? false;

  const handleLogout = async () => {
    await logout();
    router.push("/");
    setMobileMenuOpen(false);
  };

  /* Close all dropdowns on outside click */
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
        setAdminOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  /* Close everything on route change */
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenGroup(null);
    setAdminOpen(false);
  }, [pathname]);

  function filterItems(items: NavItem[]) {
    if (!user) return [] as NavItem[];
    return items.filter((item) => {
      if (item.parentOnly) return isParent;
      if (item.restrictedRoles) return !item.restrictedRoles.some((r) => user.roles.includes(r));
      return true;
    });
  }

  function isGroupActive(group: NavGroup) {
    return group.items.some(({ href }) => {
      if (pathname === href) return true;
      if (href === "/traningsdatabas" && /\/ar[123]$/.test(pathname)) return true;
      return false;
    });
  }

  function isItemActive(href: string) {
    if (pathname === href) return true;
    if (href === "/traningsdatabas" && /\/ar[123]$/.test(pathname)) return true;
    return false;
  }

  const chevron = (open: boolean) => (
    <svg
      className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <nav
      ref={navRef}
      style={{ backgroundColor: "#111827" }}
      className="text-white sticky top-0 z-50 w-full shadow-[0_2px_8px_rgba(0,0,0,0.5)] border-b border-gray-800"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14">

          {/* ── Logo ── */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 text-white hover:text-orange-400 transition-colors">
              {user ? (
                <>
                  {clubLogoUrl ? (
                    <Image src={clubLogoUrl} alt="Klubblogga" width={36} height={36} unoptimized className="rounded-full object-cover" />
                  ) : (
                    <span className="text-2xl leading-none">{sport.emoji}</span>
                  )}
                  <span className="text-lg font-extrabold tracking-tight">{clubName ?? sport.name}</span>
                </>
              ) : (
                <>
                  <Image src="/sportiq-logo.png" alt="SportIQ" width={36} height={36} unoptimized className="rounded-xl object-cover" />
                  <span className="text-lg font-extrabold tracking-tight">SportIQ</span>
                </>
              )}
            </Link>
          </div>

          {/* ── Desktop nav groups ── */}
          {user && (
            <div className="hidden md:flex flex-1 items-center justify-center gap-0.5">
              {/* Taktik — always direct, it's the core feature */}
              <Link
                href="/taktik"
                className={`relative px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap group ${
                  pathname === "/taktik" ? "text-orange-400" : "text-gray-300 hover:text-white"
                }`}
              >
                🎯 Taktik
                <span className={`absolute bottom-0 left-2 right-2 h-0.5 bg-orange-400 rounded-t transition-transform duration-300 origin-left ${
                  pathname === "/taktik" ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                }`} />
              </Link>

              {navGroups.map((group) => {
                const items = filterItems(group.items);
                if (items.length === 0) return null;
                const active = isGroupActive(group);
                const open   = openGroup === group.id;
                return (
                  <div key={group.id} className="relative">
                    <button
                      onClick={() => setOpenGroup(open ? null : group.id)}
                      className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                        active ? "text-orange-400" : "text-gray-300 hover:text-white"
                      }`}
                      aria-expanded={open}
                      aria-haspopup="true"
                    >
                      {group.label}
                      {chevron(open)}
                    </button>
                    {open && (
                      <div className="absolute left-0 mt-1 w-52 rounded-xl shadow-xl bg-gray-800 border border-gray-700 py-1 z-50">
                        {items.map(({ href, label }) => (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOpenGroup(null)}
                            className={`block px-4 py-2 text-sm transition-colors ${
                              isItemActive(href)
                                ? "text-orange-400 bg-gray-700"
                                : "text-gray-300 hover:text-white hover:bg-gray-700"
                            }`}
                          >
                            {label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Admin dropdown */}
              {isAdmin && (
                <div className="relative">
                  <button
                    onClick={() => setAdminOpen((o) => !o)}
                    className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      pathname.startsWith("/admin") || pathname === "/registret" || pathname === "/dev"
                        ? "text-orange-400"
                        : "text-gray-300 hover:text-white"
                    }`}
                    aria-expanded={adminOpen}
                    aria-haspopup="true"
                  >
                    🏛 Admin
                    {chevron(adminOpen)}
                  </button>
                  {adminOpen && (
                    <div className="absolute left-0 mt-1 w-44 rounded-xl shadow-xl bg-gray-800 border border-gray-700 py-1 z-50">
                      {adminLinks.map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setAdminOpen(false)}
                          className={`block px-4 py-2 text-sm transition-colors ${
                            pathname === href
                              ? "text-orange-400 bg-gray-700"
                              : "text-gray-300 hover:text-white hover:bg-gray-700"
                          }`}
                        >
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Right side ── */}
          <div className="ml-auto flex items-center gap-1">
            {user && (
              <>
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                  aria-label={theme === "dark" ? "Byt till ljust läge" : "Byt till mörkt läge"}
                >
                  {theme === "dark" ? "☀️" : "🌙"}
                </button>

                <Link
                  href="/meddelanden"
                  className={`flex relative items-center justify-center w-8 h-8 rounded-full transition-colors ${
                    pathname === "/meddelanden" ? "text-orange-400" : "text-gray-300 hover:text-white"
                  }`}
                  aria-label="Chatt"
                >
                  <span className="text-base leading-none">💬</span>
                  {unread > 0 && (
                    <span className="absolute top-0 right-0 text-xs font-bold bg-red-500 text-white rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 leading-none">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>

                <Link
                  href="/profil"
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors text-sm leading-none"
                  title={user.name}
                  aria-label={`Profil: ${user.name}`}
                >
                  {roleEmoji(user.roles)}
                </Link>

                <button
                  onClick={handleLogout}
                  className="hidden md:block ml-1 px-3 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 hover:text-white transition-colors whitespace-nowrap"
                >
                  Logga ut
                </button>

                <button
                  onClick={() => setMobileMenuOpen((o) => !o)}
                  className="md:hidden ml-1 p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                  aria-label={mobileMenuOpen ? "Stäng meny" : "Öppna meny"}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
              </>
            )}

            {!user && (
              <>
                <Link href="/login" className="px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white transition-colors whitespace-nowrap">
                  Logga in
                </Link>
                {!loading && (
                  <Link href="/registrera" className="px-3 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 rounded-full text-white transition-colors whitespace-nowrap">
                    Registrera
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      {user && mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-800" style={{ backgroundColor: "#111827" }}>
          <div className="px-4 py-3 space-y-0.5">
            <Link
              href="/taktik"
              className={`block px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                pathname === "/taktik" ? "text-orange-400 bg-gray-800" : "text-gray-300 hover:text-white hover:bg-gray-800"
              }`}
            >
              🎯 Taktik
            </Link>
            <div className="h-px bg-gray-700 my-1" />
            {navGroups.map((group) => {
              const items = filterItems(group.items);
              if (items.length === 0) return null;
              return (
                <div key={group.id}>
                  <p className="px-3 pt-3 pb-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {group.label}
                  </p>
                  {items.map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      className={`block px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isItemActive(href)
                          ? "text-orange-400 bg-gray-800"
                          : "text-gray-300 hover:text-white hover:bg-gray-800"
                      }`}
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              );
            })}

            {isAdmin && (
              <div>
                <p className="px-3 pt-3 pb-1 text-xs font-bold text-gray-500 uppercase tracking-wider">🏛 Admin</p>
                {adminLinks.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`block px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                      pathname === href
                        ? "text-orange-400 bg-gray-800"
                        : "text-gray-300 hover:text-white hover:bg-gray-800"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}

            <div className="h-px bg-gray-700 my-2" />
            <div className="flex items-center justify-between px-3 py-2">
              <Link href="/profil" className="text-sm text-gray-300 hover:text-white transition-colors">
                {roleEmoji(user.roles)} {user.name}
              </Link>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="px-2 py-1 text-xs font-semibold bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 hover:text-white transition-colors"
                >
                  {theme === "dark" ? "☀️ Ljust" : "🌙 Mörkt"}
                </button>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1 text-xs font-semibold bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 hover:text-white transition-colors"
                >
                  Logga ut
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
