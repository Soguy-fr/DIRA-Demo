import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getRole } from "@/lib/auth/role";
import { can, ROLE_LABELS } from "@/lib/roles";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { GuideLink } from "@/components/GuideLink";

export const dynamic = "force-dynamic";

// I2 — Chatbot « Explique-moi mes chiffres » (outils typés, jamais de SQL libre).
export default async function ChatPage() {
  if (!isSupabaseConfigured()) {
    return <Notice>Supabase n&apos;est pas encore configuré.</Notice>;
  }
  const supabase = createClient();
  const role = await getRole(supabase);
  if (!can(role, "use_ai")) {
    return <Notice>Accès IA réservé aux rôles éditeurs (votre rôle : {ROLE_LABELS[role]}).</Notice>;
  }
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold text-brand-night">Assistant budgétaire</h1>
        <GuideLink anchor="l-assistant-ia-pose-tes-questions" />
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Pose une question sur tes chiffres (suivi, bailleurs, trésorerie, écritures). L&apos;assistant
        lit les données réelles via des outils fermés — il n&apos;invente pas de chiffres.
      </p>
      <ChatPanel />
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">{children}</p>
  );
}
