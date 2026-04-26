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

const allMainLinks: { href: string; label: string; restrictedRoles: UserRole[] }[] = [
  { href: "/taktik", label: "Taktik", restrictedRoles: [] },
  { href: "/kalender", label: "Kalender", restrictedRoles: [] },
  { href: "/spelare", label: "Spelare", restrictedRoles: [] },
  { href: "/nyheter", label: "Nyheter", restrictedRoles: [] },
  { href: "/traningsdatabas", label: "Träning", restrictedRoles: [] },
  { href: "/matcher", label: "Matcher", restrictedRoles: [] },
  { href: "/cup", label: "Cuper", restrictedRoles: [] },
  { href: "/betalningar", label: "Betalningar", restrictedRoles: ["player", "parent"] },
];

const merDropdownLinks: { href: string; label: string; restrictedRoles: UserRole[] }[] = [
  { href: "/mal", label: "🎯 Säsongsmål", restrictedRoles: [] },
  { href: "/utveckling", label: "📈 Spelarutveckling", restrictedRoles: [] },
  { href: "/statistik", label: "📊 Statistik", restrictedRoles: ["player", "parent"] },
  { href: "/mallar", label: "📋 Mallar", restrictedRoles: ["player", "parent"] },
  { href: "/utrustning", label: "🎒 Utrustning", restrictedRoles: ["player", "parent"] },
  { href: "/videor", label: "🎬 Videor", restrictedRoles: [] },
  { href: "/dokument", label: "📁 Dokument", restrictedRoles: [] },
];

const adminDropdownLinks = [
  { href: "/admin", label: "🏛 Adminpanel" },
  { href: "/registret", label: "👥 Registret" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, getMyTeam } = useAuth();
  const unread = useUnreadCount();

  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const [merDropdownOpen, setMerDropdownOpen] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const merDropdownRef = useRef<HTMLDivElement>(null);

  const sportId = user?.sport ?? "basket";
  const sport = getSport(sportId);
  /* Club logo: from admin's own profile or from the team they belong to */
  const team = getMyTeam();
  const clubLogoUrl = user?.clubLogoUrl ?? team?.clubLogoUrl ?? null;
  /* Club name: admin has it on their profile; coaches/players get it from the team */
  const clubName = user?.clubName ?? team?.clubName ?? null;

  const handleLogout = async () => {
    await logout();
    router.push("/");
    setMobileMenuOpen(false);
  };

  /* Close dropdowns when clicking outside */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target as Node))
        setAdminDropdownOpen(false);
      if (merDropdownRef.current && !merDropdownRef.current.contains(event.target as Node))
        setMerDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* Close mobile menu on route change */
  useEffect(() => {
    setMobileMenuOpen(false);
    setAdminDropdownOpen(false);
    setMerDropdownOpen(false);
  }, [pathname]);

  const isAdmin = user?.roles.includes("admin") ?? false;
  const isCoach = user?.roles.some((r) => r === "coach") ?? false;
  const isAssistantOrPlayer =
    user?.roles.some((r) => ["assistant", "player"].includes(r)) ?? false;
  const isParent = user?.roles.includes("parent") ?? false;

  /* Filter main links based on user role */
  const mainLinks = allMainLinks.filter(
    ({ restrictedRoles }) =>
      !user || !restrictedRoles.some((r) => user.roles.includes(r))
  );
  const merLinks = merDropdownLinks.filter(
    ({ restrictedRoles }) =>
      !user || !restrictedRoles.some((r) => user.roles.includes(r))
  );

  /* Right-side role links (excluding admin which has its own dropdown) */
  const rightLinks = isAdmin
    ? [{ href: "/dev", label: "🛠 Utveckling" }]
    : isCoach
    ? [
        { href: "/lag", label: `${sport.emoji} Laget` },
        { href: "/registret", label: "👥 Registret" },
      ]
    : isAssistantOrPlayer
    ? [{ href: "/lag", label: `${sport.emoji} Laget` }]
    : isParent
    ? [
        { href: "/lag", label: `${sport.emoji} Laget` },
        { href: "/familj", label: "👪 Min sida" },
      ]
    : [];

  return (
    <nav
      style={{ backgroundColor: "#111827" }}
      className="text-white sticky top-0 z-50 w-full shadow-[0_2px_8px_rgba(0,0,0,0.5)] border-b border-gray-800"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14">

          {/* ── LEFT: Logo / Brand ── */}
          <div className="flex-shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2 text-white hover:text-orange-400 transition-colors"
            >
              {user ? (
                <>
                  {clubLogoUrl ? (
                    <Image
                      src={clubLogoUrl}
                      alt="Klubblogga"
                      width={36}
                      height={36}
                      unoptimized
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl leading-none">{sport.emoji}</span>
                  )}
                  <span className="text-lg font-extrabold tracking-tight">
                    {clubName ?? sport.name}
                  </span>
                </>
              ) : (
                <>
                  <Image
                    src="/sportiq-logo.png"
                    alt="SportIQ"
                    width={36}
                    height={36}
                    unoptimized
                    className="rounded-xl object-cover"
                  />
                  <span className="text-lg font-extrabold tracking-tight">SportIQ</span>
                </>
              )}
            </Link>
          </div>

          {/* ── CENTER: Main nav links (hidden on mobile) ── */}
          {user && (
            <div className="hidden md:flex flex-1 items-center justify-center gap-1">
              {mainLinks.map(({ href, label }) => {
                const isActive =
                  pathname === href ||
                  (href === "/traningsdatabas" && /\/ar[123]$/.test(pathname));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative px-3 py-2 text-sm font-medium transition-colors group whitespace-nowrap ${
                      isActive
                        ? "text-orange-400"
                        : "text-gray-300 hover:text-white"
                    }`}
                  >
                    {label}
                    <span
                      className={`absolute bottom-0 left-2 right-2 h-0.5 bg-orange-400 rounded-t transition-transform duration-300 origin-left ${
                        isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </Link>
                );
              })}
              {/* Mer dropdown */}
              {merLinks.length > 0 && (
                <div className="relative" ref={merDropdownRef}>
                  <button
                    onClick={() => setMerDropdownOpen((o) => !o)}
                    className={`flex items-center gap-1 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                      merLinks.some((l) => pathname === l.href)
                        ? "text-orange-400"
                        : "text-gray-300 hover:text-white"
                    }`}
                    aria-expanded={merDropdownOpen}
                    aria-haspopup="true"
                  >
                    Mer
                    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${merDropdownOpen ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {merDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-40 rounded-lg shadow-xl bg-gray-800 border border-gray-700 py-1 z-50">
                      {merLinks.map(({ href, label }) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setMerDropdownOpen(false)}
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

          {/* ── RIGHT: Tools + Auth ── */}
          <div className="ml-auto flex items-center gap-1">
            {user && (
              <>
                {/* Admin dropdown (desktop only) */}
                {isAdmin && (
                  <div className="hidden md:block relative" ref={adminDropdownRef}>
                    <button
                      onClick={() => setAdminDropdownOpen((o) => !o)}
                      className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                        pathname.startsWith("/admin") ||
                        pathname === "/registret" ||
                        pathname === "/anslut"
                          ? "text-orange-400"
                          : "text-gray-300 hover:text-white"
                      }`}
                      aria-expanded={adminDropdownOpen}
                      aria-haspopup="true"
                    >
                      🏛 Admin
                      <svg
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          adminDropdownOpen ? "rotate-180" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>
                    {adminDropdownOpen && (
                      <div className="absolute right-0 mt-1 w-44 rounded-lg shadow-xl bg-gray-800 border border-gray-700 py-1 z-50">
                        {adminDropdownLinks.map(({ href, label }) => (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setAdminDropdownOpen(false)}
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

                {/* Other role-based links (desktop only) */}
                <div className="hidden md:flex items-center">
                  {rightLinks.map(({ href, label }) => {
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={`relative px-3 py-1.5 text-sm font-medium transition-colors group whitespace-nowrap ${
                          isActive ? "text-orange-400" : "text-gray-300 hover:text-white"
                        }`}
                      >
                        {label}
                        <span
                          className={`absolute bottom-0 left-2 right-2 h-0.5 bg-orange-400 rounded-t transition-transform duration-300 origin-left ${
                            isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                          }`}
                        />
                      </Link>
                    );
                  })}
                </div>

                {/* Theme toggle */}
                <button
                  onClick={toggleTheme}
                  className="flex items-center justify-center w-8 h-8 rounded-full text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                  aria-label={theme === "dark" ? "Byt till ljust läge" : "Byt till mörkt läge"}
                  title={theme === "dark" ? "Ljust läge" : "Mörkt läge"}
                >
                  {theme === "dark" ? "☀️" : "🌙"}
                </button>

                {/* Messages icon */}
                <Link
                  href="/meddelanden"
                  className={`flex relative items-center justify-center w-8 h-8 rounded-full transition-colors ${
                    pathname === "/meddelanden"
                      ? "text-orange-400"
                      : "text-gray-300 hover:text-white"
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

                {/* Profile icon */}
                <Link
                  href="/profil"
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors text-sm leading-none"
                  title={user.name}
                  aria-label={`Profil: ${user.name}`}
                >
                  {roleEmoji(user.roles)}
                </Link>

                {/* Logout (desktop only) */}
                <button
                  onClick={handleLogout}
                  className="hidden md:block ml-1 px-3 py-1.5 text-xs font-semibold bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 hover:text-white transition-colors whitespace-nowrap"
                >
                  Logga ut
                </button>

                {/* Hamburger button (mobile only) */}
                <button
                  onClick={() => setMobileMenuOpen((o) => !o)}
                  className="md:hidden ml-1 p-2 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
                  aria-label={mobileMenuOpen ? "Stäng meny" : "Öppna meny"}
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  )}
                </button>
              </>
            )}

            {/* Logged-out state */}
            {!user && (
              <>
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs font-semibold text-gray-300 hover:text-white transition-colors whitespace-nowrap"
                >
                  Logga in
                </Link>
                {!loading && (
                  <Link
                    href="/registrera"
                    className="px-3 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 rounded-full text-white transition-colors whitespace-nowrap"
                  >
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
          <div className="px-4 py-3 space-y-1">

            {/* Main nav links */}
            {mainLinks.map(({ href, label }) => {
              const isActive =
                pathname === href ||
                (href === "/traningsdatabas" && /\/ar[123]$/.test(pathname));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`block px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isActive
                      ? "text-orange-400 bg-gray-800"
                      : "text-gray-300 hover:text-white hover:bg-gray-800"
                  }`}
                >
                  {label}
                </Link>
              );
            })}

            {/* Mer links (mobile) */}
            {merLinks.length > 0 && (
              <>
                <div className="h-px bg-gray-700 my-2" />
                {merLinks.map(({ href, label }) => (
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
              </>
            )}

            {/* Admin links (mobile) */}
            {isAdmin && (
              <>
                <div className="h-px bg-gray-700 my-2" />
                {adminDropdownLinks.map(({ href, label }) => (
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
              </>
            )}

            {/* Other role links (mobile) */}
            {rightLinks.length > 0 && (
              <>
                <div className="h-px bg-gray-700 my-2" />
                {rightLinks.map(({ href, label }) => (
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
              </>
            )}

            <div className="h-px bg-gray-700 my-2" />

            {/* Profile + logout + theme toggle (mobile) */}
            <div className="flex items-center justify-between px-3 py-2">
              <Link
                href="/profil"
                className="text-sm text-gray-300 hover:text-white transition-colors"
              >
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
