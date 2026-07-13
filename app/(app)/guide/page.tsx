import { readFileSync } from "fs";
import path from "path";
import { mdToHtml, extractHeadings } from "@/lib/markdown";

// Guide utilisateur : rendu HTML de guide.md (source unique de vérité).
export default function GuidePage() {
  let md: string;
  try {
    md = readFileSync(path.join(process.cwd(), "guide.md"), "utf8");
  } catch {
    return (
      <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">
        guide.md introuvable à la racine du projet.
      </p>
    );
  }
  const toc = extractHeadings(md, 2);
  const html = mdToHtml(md);

  return (
    <div className="flex max-w-5xl gap-8">
      {/* Sommaire collant */}
      <nav className="hidden w-56 shrink-0 lg:block">
        <div className="sticky top-4 rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <div className="mb-2 font-bold uppercase tracking-wide text-slate-400">Sommaire</div>
          <ul className="space-y-1.5">
            {toc.map((h) => (
              <li key={h.slug}>
                <a href={`#${h.slug}`} className="text-slate-600 hover:text-brand-emerald">
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Contenu : classes appliquées via le wrapper guide-prose (globals ci-dessous) */}
      <article
        className="guide-prose min-w-0 flex-1 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Styles dédiés au guide (un seul endroit, pas de plugin typography) */}
      <style>{`
        .guide-prose { line-height: 1.65; color: #334155; font-size: 0.9rem; }
        .guide-prose h1 { font-size: 1.5rem; font-weight: 800; color: #1E293B; margin: 0 0 .75rem; }
        .guide-prose h2 { font-size: 1.15rem; font-weight: 700; color: #1E293B; margin: 2rem 0 .5rem; scroll-margin-top: 1rem; }
        .guide-prose h3 { font-size: 1rem; font-weight: 700; color: #334155; margin: 1.25rem 0 .4rem; }
        .guide-prose p { margin: .5rem 0; }
        .guide-prose ul, .guide-prose ol { margin: .5rem 0 .5rem 1.25rem; list-style: disc; }
        .guide-prose ol { list-style: decimal; }
        .guide-prose ul ul { list-style: circle; margin-top: .15rem; }
        .guide-prose li { margin: .2rem 0; }
        .guide-prose blockquote { margin: .75rem 0; padding: .6rem .9rem; border-left: 4px solid #0FA86B; background: #f0fdf6; border-radius: 0 .375rem .375rem 0; }
        .guide-prose blockquote p { margin: 0; }
        .guide-prose hr { margin: 1.5rem 0; border-color: #e2e8f0; }
        .guide-prose strong { color: #1E293B; }
      `}</style>
    </div>
  );
}
