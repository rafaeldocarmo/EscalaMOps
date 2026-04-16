/**
 * `pg` / `pg-connection-string` emite aviso quando `sslmode` é `prefer`, `require` ou `verify-ca`
 * (na próxima major deixam de ser aliases de `verify-full`).
 *
 * Define `sslmode=verify-full` explicitamente para manter o comportamento atual e silenciar o aviso.
 *
 * @see https://www.postgresql.org/docs/current/libpq-ssl.html
 */
export function normalizePgConnectionString(connectionString: string): string {
  if (!connectionString.trim()) return connectionString;
  try {
    const u = new URL(connectionString);
    const mode = u.searchParams.get("sslmode")?.toLowerCase();
    if (mode === "prefer" || mode === "require" || mode === "verify-ca") {
      u.searchParams.set("sslmode", "verify-full");
      return u.toString();
    }
  } catch {
    /* URL inválida ou formato não parseável — mantém original */
  }
  return connectionString;
}
