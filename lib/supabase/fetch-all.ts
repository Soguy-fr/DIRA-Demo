// PostgREST plafonne chaque requête à `db-max-rows` (1000 par défaut) — même avec
// `.range(0, 99999)`. Pour les tables volumineuses (budget_monthly), paginer pour
// tout récupérer, sinon les totaux sont silencieusement tronqués.
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data } = await build(from, from + page - 1);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}
