/**
 * Prisma + pg via adapter podem envolver o erro do Postgres (ex.: código SQLSTATE 23505)
 * sem a palavra "unique" na mensagem do nível superior — por isso não basta checar `e.message`.
 */
export function flattenErrorChain(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let i = 0; i < 8; i++) {
    if (cur instanceof Error) {
      parts.push(cur.message);
      cur = cur.cause;
    } else if (typeof cur === "object" && cur !== null) {
      const obj = cur as Record<string, unknown>;
      if ("code" in obj && obj.code !== undefined) {
        parts.push(String(obj.code));
      }
      if ("detail" in obj && obj.detail !== undefined) {
        parts.push(String(obj.detail));
      }
      if ("cause" in obj) {
        cur = obj.cause;
        continue;
      }
      break;
    } else {
      break;
    }
  }
  return parts.join(" \n ");
}

/** Violation of unique index (Prisma P2002 ou Postgres 23505, inclusive encadeados). */
/** Coluna inexistente no banco (schema desatualizado ou client Prisma antigo em dev). */
export function isPrismaColumnMismatchError(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 10; i++) {
    if (cur && typeof cur === "object" && "code" in cur && (cur as { code: unknown }).code === "P2022") {
      return true;
    }
    cur =
      cur instanceof Error
        ? cur.cause
        : typeof cur === "object" && cur !== null && "cause" in cur
          ? (cur as { cause: unknown }).cause
          : null;
    if (cur === undefined || cur === null) break;
  }
  return false;
}

export function isUniqueConstraintError(e: unknown): boolean {
  let cur: unknown = e;
  for (let i = 0; i < 10; i++) {
    if (cur && typeof cur === "object") {
      const code = (cur as { code?: unknown }).code;
      if (code === "P2002" || code === "23505" || String(code) === "23505") {
        return true;
      }
    }
    const text = cur instanceof Error ? cur.message : "";
    if (/unique|P2002|23505|duplicate key|violat.*uniq/i.test(text)) {
      return true;
    }
    cur =
      cur instanceof Error
        ? cur.cause
        : typeof cur === "object" && cur !== null && "cause" in cur
          ? (cur as { cause: unknown }).cause
          : null;
    if (cur === undefined || cur === null) break;
  }
  return false;
}
