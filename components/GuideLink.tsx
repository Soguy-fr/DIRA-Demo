import Link from "next/link";

// Bouton « Guide » : mène à la section correspondante du guide utilisateur.
export function GuideLink({ anchor }: { anchor: string }) {
  return (
    <Link
      href={`/guide#${anchor}`}
      className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-brand-night"
      title="Ouvrir le guide utilisateur sur cette section"
    >
      📖 Guide
    </Link>
  );
}
