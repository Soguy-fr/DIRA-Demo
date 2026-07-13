// Indique si les variables d'environnement Supabase sont présentes.
// Permet aux pages de dégrader proprement tant que Supabase n'est pas branché.
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
