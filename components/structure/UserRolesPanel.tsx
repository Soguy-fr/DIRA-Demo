"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { setUserRole, type UserRow } from "@/app/(app)/structure/users-actions";

// F12.8 — gestion des comptes : liste des utilisateurs Auth + attribution du rôle.
export function UserRolesPanel({
  users,
  loadError,
}: {
  users: UserRow[];
  loadError?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="mt-10 rounded border border-slate-200 bg-white p-4">
      <h2 className="mb-1 text-lg font-bold text-brand-night">Comptes utilisateurs</h2>
      <p className="mb-3 text-sm text-slate-500">
        Attribuez un rôle à chaque compte. La création/suppression des comptes se
        fait côté Supabase. Le rôle <strong>Admin système</strong> est réservé et
        verrouillé.
      </p>

      {loadError && (
        <p className="mb-3 rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-800">
          {loadError}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {users.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-1.5">Email</th>
              <th className="py-1.5">Rôle</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const locked = u.role === "admin_systeme";
              return (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-1.5">{u.email}</td>
                  <td className="py-1.5">
                    {locked ? (
                      <span className="text-slate-500">
                        {ROLE_LABELS.admin_systeme} (verrouillé)
                      </span>
                    ) : (
                      <select
                        defaultValue={u.role}
                        disabled={pending}
                        onChange={(e) => {
                          const role = e.target.value as Role;
                          setError(null);
                          startTransition(async () => {
                            const res = await setUserRole(u.id, role);
                            if (!res.ok) setError(res.error ?? "Erreur.");
                            else router.refresh();
                          });
                        }}
                        className="rounded border border-slate-300 px-2 py-1"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
