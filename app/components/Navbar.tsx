"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Hem" },
  { href: "/ar1", label: "År 1 (≤7 år)" },
  { href: "/ar2", label: "År 2 (8 år)" },
  { href: "/ar3", label: "År 3 (9 år)" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-50" aria-label="Main navigation">
      <div className="max-w-5xl mx-auto px-4 py-0 flex flex-wrap items-stretch gap-1">
        <Link
          href="/"
          className="flex items-center gap-2 mr-6 py-4 text-white hover:text-orange-400 transition-colors"
        >
          <span className="text-2xl">🏀</span>
          <span className="text-lg font-bold tracking-tight">Basket</span>
        </Link>

        <div className="flex items-stretch gap-1">
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`relative flex items-center px-4 py-4 text-sm font-medium transition-colors ${
                pathname === href
                  ? "text-orange-400"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {label}
              {pathname === href && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400 rounded-t" />
              )}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
