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
    <nav className="bg-orange-600 text-white shadow-md">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-2">
        <span className="mr-4 text-xl font-bold tracking-wide">🏀 Basket</span>
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              pathname === href
                ? "bg-white text-orange-600"
                : "hover:bg-orange-500"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
