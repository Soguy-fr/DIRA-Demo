"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShauriLogo } from "@/components/ShauriLogo";

const NAV = [
  { href: "/budgets", label: "Scénario" },
  { href: "/interne", label: "Suivi interne" },
  { href: "/tresorerie", label: "Trésorerie" },
  { href: "/financements", label: "Financement" },
  { href: "/grand-livre", label: "Grand Livre" },
  { href: "/suivi", label: "Dashboard" },
  { href: "/cloture", label: "Clôture" },
  { href: "/chat", label: "Assistant IA" },
  { href: "/audit", label: "Audit" },
  { href: "/structure", label: "Configuration" },
  { href: "/guide", label: "📖 Guide" },
  { href: "/export", label: "⬇ Export" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex min-h-screen w-52 shrink-0 flex-col border-r border-slate-200 bg-white p-3">
      <div className="mb-5 flex items-center gap-2.5 px-2">
        <ShauriLogo className="h-10 w-auto" />
        <div className="flex flex-col leading-tight">
          <span className="text-base font-semibold tracking-tight text-brand-ink">
            DIRA Budget
          </span>
          <span className="text-[11px] font-medium text-brand-primary">
            by Shauri
          </span>
        </div>
      </div>
      <div className="mb-4 rounded-md bg-brand-primary/10 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">
          Association
        </span>
        <div className="text-sm font-medium text-brand-ink">Sauve un arbre</div>
      </div>
      <ul className="space-y-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-3 py-1.5 text-sm ${
                  active
                    ? "bg-brand-ink text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto px-2 pt-4 text-[11px] text-brand-muted">
        DIRA Budget, by Shauri
      </div>
    </nav>
  );
}
