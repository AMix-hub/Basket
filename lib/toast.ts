export function toast(message: string, type: "success" | "error" | "info" = "success") {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  const bg = type === "success" ? "bg-emerald-600" : type === "error" ? "bg-red-600" : "bg-slate-700";
  el.className = `fixed bottom-6 right-6 z-[9999] px-4 py-3 rounded-xl text-sm font-semibold shadow-xl text-white transition-opacity duration-300 ${bg}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 2800);
}
