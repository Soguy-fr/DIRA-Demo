"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <nav className="w-48 shrink-0 border-r border-slate-200 bg-white p-3">
      <div className="mb-4 flex flex-col items-start gap-2 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Terra Mucho"
          className="h-16 w-auto"
        />
        <span className="font-heading text-sm font-bold leading-tight text-brand-terracotta">
          Suivi financier Terra Mucho
        </span>
      </div>
      <ul className="space-y-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded px-3 py-1.5 text-sm ${
                  active
                    ? "bg-brand-night text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
