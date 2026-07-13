"use client";

import { useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; tools?: string[] };

const SUGGESTIONS = [
  "Quel est le solde de trésorerie prévu en fin d'année ?",
  "Quelles lignes budgétaires dépassent leur budget cette année ?",
  "Combien reste-t-il à recevoir de chaque bailleur ?",
  "Montre-moi les dépenses de mars.",
];

export function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? `Erreur ${res.status}`);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: json.reply, tools: json.tools_used }]);
      }
    } catch {
      setError("Réseau indisponible.");
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">Exemples :</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block rounded border border-slate-200 px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "bg-brand-night text-white" : "bg-slate-100 text-slate-800"
              }`}
            >
              {m.content}
              {m.tools && m.tools.length > 0 && (
                <div className="mt-1 text-[10px] text-slate-400">
                  données lues : {Array.from(new Set(m.tools)).join(", ")}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && <p className="text-sm text-slate-400">L&apos;assistant consulte les données…</p>}
        {error && (
          <p className="rounded border border-alert/30 bg-red-50 p-2 text-sm text-alert">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-slate-100 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pose ta question…"
          className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded bg-brand-night px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
