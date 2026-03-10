/**
 * Returns "FirstName LastName" (first word + last word).
 * Single word returns as-is.
 */
export function formatMemberName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 1) return trimmed;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  return `${first} ${last}`;
}
