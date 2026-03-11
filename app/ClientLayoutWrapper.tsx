"use client";

import { usePathname } from "next/navigation";
import Navbar from "./components/Navbar";
import CoachClipboard from "./components/CoachClipboard";

/**
 * Wraps page content with Navbar + CoachClipboard for all routes except
 * `/cast`, where a clean fullscreen layout is used instead.
 */
export function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (pathname === "/cast") {
    /* Cast view: fullscreen, no navigation chrome */
    return <>{children}</>;
  }

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-10">{children}</main>
      <CoachClipboard />
    </>
  );
}
