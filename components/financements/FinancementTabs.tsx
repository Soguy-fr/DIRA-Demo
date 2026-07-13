import Link from "next/link";

// F4.14 — onglets du menu Financement.
export function FinancementTabs({ active }: { active: "financements" | "bailleurs" }) {
  const tab = (key: "financements" | "bailleurs", href: string, label: string) => (
    <Link
      href={href}
      className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${
        active === key
          ? "border-brand-emerald font-medium text-brand-night"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-4 flex gap-2 border-b border-slate-200">
      {tab("financements", "/financements", "Financements")}
      {tab("bailleurs", "/financements?tab=bailleurs", "Bailleurs")}
    </div>
  );
}
