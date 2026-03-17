/** Formats a YYYY-MM-DD dateKey as DD/MM/YYYY. */
export function formatDateKeyToDDMMYYYY(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

