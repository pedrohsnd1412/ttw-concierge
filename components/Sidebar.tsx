"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WordmarkInline } from "./Brand";

const NAV = [
  { href: "/dashboard", label: "Inteligência de Destinos", desc: "Insights da base" },
  { href: "/concierge", label: "Concierge de Roteiros", desc: "Gerar roteiro" },
  { href: "/descobrir", label: "Descobrir Destino", desc: "Pelos gostos do cliente" },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Barra superior — apenas mobile */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-line bg-ink/95 px-5 py-3.5 backdrop-blur-xl lg:hidden">
        <WordmarkInline />
        <button
          aria-label="Abrir menu"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ivory/80 transition hover:border-champagne/50 hover:text-champagne"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {/* Backdrop do drawer — mobile */}
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        data-sidebar
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-line bg-ink/95 px-6 py-8 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between px-2">
          <WordmarkInline />
          <button
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ivory/70 transition hover:text-champagne lg:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="my-7 hairline" />
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => {
            const active = path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`group rounded-lg border px-4 py-3 transition ${
                  active
                    ? "border-champagne/40 bg-champagne/10"
                    : "border-transparent hover:border-line hover:bg-surface/40"
                }`}
              >
                <span className={`block text-sm ${active ? "text-champagne" : "text-ivory/90"}`}>
                  {n.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{n.desc}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-6">
          <div className="my-5 hairline" />
          <div className="flex items-center justify-between px-2">
            <div>
              <p className="text-sm text-ivory/90">Consultor TTW</p>
              <p className="text-xs text-muted">consultor@ttw.com</p>
            </div>
            <button onClick={logout} className="text-xs uppercase tracking-[0.12em] text-muted transition hover:text-champagne">
              Sair
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
