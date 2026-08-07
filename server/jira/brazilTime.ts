import { BRAZIL_TZ_OFFSET_MINUTES, SLA_WINDOW_END, SLA_WINDOW_START } from "@/server/jira/constants";

const BR_OFFSET_MS = BRAZIL_TZ_OFFSET_MINUTES * 60 * 1000;

/** Reinterpreta um instante como "hora local de Brasília" nos campos UTC do Date resultante. */
export function toBrazilWallClock(instant: Date): Date {
  return new Date(instant.getTime() + BR_OFFSET_MS);
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** Equivalente a `breach_dt.strftime("%Y-%m-%d %H:%M:%S")` sobre um datetime ciente do fuso de Brasília. */
export function formatBrazilDateTime(instant: Date): string {
  const w = toBrazilWallClock(instant);
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())} ${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}:${pad(w.getUTCSeconds())}`;
}

/** Equivalente a `breach_dt.strftime("%H:%M")` sobre um datetime ciente do fuso de Brasília. */
export function formatBrazilTime(instant: Date): string {
  const w = toBrazilWallClock(instant);
  return `${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
}

/** Operação inversa de `toBrazilWallClock`: devolve o instante real (UTC) correspondente. */
function fromBrazilWallClock(wallClock: Date): Date {
  return new Date(wallClock.getTime() - BR_OFFSET_MS);
}

export interface BrazilSlaWindow {
  windowStart: Date;
  windowEnd: Date;
}

/**
 * Janela do SLA (07:00–23:59, fuso de Brasília fixo em UTC-3) para o dia
 * atual + `daysAhead` dias, calculada a partir de `now`. Port da lógica em
 * `fetch_chamados_a_violar`/`build_daily_report` (jira_extractor.py).
 */
export function brazilSlaWindow(now: Date, daysAhead: number): BrazilSlaWindow {
  const wallNow = toBrazilWallClock(now);
  const targetWallDay = new Date(
    Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), wallNow.getUTCDate() + daysAhead)
  );

  const wallStart = new Date(targetWallDay);
  wallStart.setUTCHours(SLA_WINDOW_START.hour, SLA_WINDOW_START.minute, SLA_WINDOW_START.second, 0);

  const wallEnd = new Date(targetWallDay);
  wallEnd.setUTCHours(SLA_WINDOW_END.hour, SLA_WINDOW_END.minute, SLA_WINDOW_END.second, 0);

  return {
    windowStart: fromBrazilWallClock(wallStart),
    windowEnd: fromBrazilWallClock(wallEnd),
  };
}
