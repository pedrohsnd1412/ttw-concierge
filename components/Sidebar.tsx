"use client";
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

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside
      data-sidebar
      className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-line bg-ink/95 px-6 py-8 backdrop-blur-xl lg:flex"
    >
      <div className="px-2">
        <WordmarkInline />
      </div>
      <div className="my-7 hairline" />
      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((n) => {
          const active = path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
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
  );
}
