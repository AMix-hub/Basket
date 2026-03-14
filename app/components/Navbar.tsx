"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { useUnreadCount } from "../hooks/useUnreadCount";
import { roleEmoji } from "../../lib/roleLabels";
import { getSport } from "../../lib/sports";

const basketYearLinks = [
  { href: "/ar1", label: "År 1", sub: "≤7 år" },
  { href: "/ar2", label: "År 2", sub: "8 år" },
  { href: "/ar3", label: "År 3", sub: "9 år" },
];

function getSportYearLinks(sportId: string) {
  if (sportId === "basket") return basketYearLinks;
  return [
    { href: `/${sportId}/ar1`, label: "År 1", sub: "≤7 år" },
    { href: `/${sportId}/ar2`, label: "År 2", sub: "8 år" },
    { href: `/${sportId}/ar3`, label: "År 3", sub: "9 år" },
  ];
}

const mainLinks = [
  { href: "/taktik", label: "Taktiktavla" },
  { href: "/kalender", label: "Kalender" },
  { href: "/statistik", label: "Statistik" },
  { href: "/videor", label: "Videor" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout, getMyTeam } = useAuth();
  const unread = useUnreadCount();

  const sportId = user?.sport ?? "basket";
  const sport = getSport(sportId);
  const yearLinks = getSportYearLinks(sportId);
  const sportHome = sportId === "basket" ? "/basket" : `/${sportId}`;

  /* Club logo: from admin's own profile or from the team they belong to */
  const team = getMyTeam();
  const clubLogoUrl = user?.clubLogoUrl ?? team?.clubLogoUrl ?? null;
  /* Club name: admin has it on their profile; coaches/players get it from the team */
  const clubName = user?.clubName ?? team?.clubName ?? null;

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  /* Extra links shown based on role */
  const roleLinks =
    user?.roles.includes("parent")
      ? [{ href: "/familj", label: "👪 Min sida" }]
      : user?.roles.includes("admin")
      ? [{ href: "/admin", label: "🏛 Admin" }, { href: "/dev", label: "🛠 Utveckling" }]
      : user?.roles.some((r) => ["coach", "assistant", "player"].includes(r))
      ? [{ href: "/lag", label: `${sport.emoji} Laget` }]
      : [];

  return (
    <nav
      className="bg-slate-900 text-white shadow-lg sticky top-0 z-50 w-full"
      aria-label="Main navigation"
    >
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-2 overflow-x-auto py-2.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">

          {/* ── Logo / Brand (only when logged in) ── */}
          {user && (
            <Link
              href={sportHome}
              className="flex items-center gap-2 py-1 text-white hover:text-orange-400 transition-colors shrink-0 mr-2"
            >
              {clubLogoUrl ? (
                <Image
                  src={clubLogoUrl}
                  alt="Klubblogga"
                  width={50}
                  height={50}
                  unoptimized
                  className="rounded-full object-cover"
                />
              ) : (
                <span className="text-2xl leading-none">{sport.emoji}</span>
              )}
              <span className="text-xl font-extrabold tracking-tight">
                {sport.name}
              </span>
              {clubName && (
                <span className="hidden sm:block text-xs text-slate-400 font-normal ml-1">
                  {clubName}
                </span>
              )}
            </Link>
          )}

          {/* ── Rest of nav: only shown when logged in ── */}
          {user && (
            <>
              <span className="h-5 w-px bg-slate-700 shrink-0" aria-hidden="true" />

              {/* Year pill buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {yearLinks.map(({ href, label, sub }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-1 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-orange-500 text-white shadow-sm"
                          : "bg-slate-700/60 text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {label}
                      <span
                        className={`text-xs ${
                          isActive ? "text-orange-100/80" : "text-slate-500"
                        }`}
                      >
                        {sub}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <span className="h-5 w-px bg-slate-700 shrink-0" aria-hidden="true" />

              {/* Main nav links */}
              <div className="flex items-stretch shrink-0">
                {mainLinks.map(({ href, label }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`relative flex items-center px-4 py-1 text-sm font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? "text-orange-400"
                          : "text-slate-300 hover:text-white"
                      }`}
                    >
                      {label}
                      {isActive && (
                        <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-orange-400 rounded-t" />
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Role-based links */}
              {roleLinks.length > 0 && (
                <>
                  <span className="h-5 w-px bg-slate-700 shrink-0" aria-hidden="true" />
                  <div className="flex items-stretch shrink-0">
                    {roleLinks.map(({ href, label }) => {
                      const isActive = pathname === href;
                      return (
                        <Link
                          key={href}
                          href={href}
                          className={`relative flex items-center px-4 py-1 text-sm font-medium transition-colors whitespace-nowrap ${
                            isActive
                              ? "text-orange-400"
                              : "text-slate-300 hover:text-white"
                          }`}
                        >
                          {label}
                          {isActive && (
                            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-orange-400 rounded-t" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Messages link */}
              <>
                <span className="h-5 w-px bg-slate-700 shrink-0" aria-hidden="true" />
                <Link
                  href="/meddelanden"
                  className={`relative flex items-center gap-1.5 px-3 py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    pathname === "/meddelanden"
                      ? "text-orange-400"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <span>💬</span>
                  <span>Chatt</span>
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-1 text-xs font-bold bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                  {pathname === "/meddelanden" && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-orange-400 rounded-t" />
                  )}
                </Link>
              </>
            </>
          )}

          {/* Auth section */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {user ? (
              <>
                <span className="text-xs text-slate-400 hidden sm:block whitespace-nowrap">
                  {roleEmoji(user.roles)}{" "}
                  <Link
                    href="/profil"
                    className="hover:text-white transition-colors"
                  >
                    {user.name}
                  </Link>
                </span>
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 rounded-full text-slate-300 hover:text-white transition-colors whitespace-nowrap"
                >
                  Logga ut
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors whitespace-nowrap"
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
    </nav>
  );
}
