"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/suivi", label: "Dépenses" },
  { href: "/suivi/bailleurs", label: "Bailleurs" },
  { href: "/suivi/graphiques", label: "Graphiques" },
];

export function SuiviTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex gap-2 border-b border-slate-200">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
              active
                ? "border-brand-emerald font-medium text-brand-night"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
