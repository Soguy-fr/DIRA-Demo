"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ShauriLogo } from "@/components/ShauriLogo";

// Authentification mono-utilisateur (F10.1). Email + mot de passe Supabase.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Connexion Supabase non configurée (voir .env.local).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-canvas">
      <form
        onSubmit={onSubmit}
        className="w-80 space-y-4 rounded-xl border border-slate-200 bg-white p-7 shadow-sm"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <ShauriLogo className="h-14 w-auto" />
          <div>
            <h1 className="text-2xl font-light tracking-tight text-brand-ink">
              DIRA Budget
            </h1>
            <p className="text-xs font-medium text-brand-primary">by Shauri</p>
          </div>
          <p className="text-xs text-brand-muted">
            Suivi budgétaire — Sauve un arbre
          </p>
        </div>
        <div>
          <label className="block text-sm text-slate-600">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-slate-600">Mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        {error && <p className="text-sm text-alert">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-primary py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
