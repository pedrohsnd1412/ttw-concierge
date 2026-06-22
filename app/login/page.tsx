"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Wordmark } from "@/components/Brand";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("consultor@ttw.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push(params.get("next") || "/dashboard");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Não foi possível entrar.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md fadeup">
        <div className="mb-10 flex flex-col items-center">
          <Wordmark size="lg" />
        </div>
        <div className="card p-10">
          <p className="eyebrow text-center">Acesso exclusivo · Consultores</p>
          <h1 className="mt-3 text-center font-sans text-3xl font-medium text-ivory">Bem-vindo de volta</h1>
          <p className="mt-2 text-center text-sm text-muted">
            A inteligência de roteiros da TTW, em um só lugar.
          </p>
          <div className="my-8 hairline" />
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="eyebrow">E-mail</label>
              <input
                type="email"
                className="input-luxe mt-2"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div>
              <label className="eyebrow">Senha</label>
              <input
                type="password"
                className="input-luxe mt-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button className="btn-gold w-full" disabled={loading}>
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
        <p className="mt-8 text-center text-[10px] uppercase tracking-luxe text-muted/50">
          TTW Group · Travel The World
        </p>
      </div>
    </main>
  );
}
