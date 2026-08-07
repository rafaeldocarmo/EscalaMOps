import { afterEach, describe, expect, it, vi } from "vitest";
import { brazilSlaWindow, formatBrazilDateTime, formatBrazilTime } from "@/server/jira/brazilTime";

afterEach(() => {
  vi.useRealTimers();
});

describe("brazilSlaWindow", () => {
  it("calcula a janela 07:00-23:59 (Brasília) do dia atual", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00Z"));

    const { windowStart, windowEnd } = brazilSlaWindow(new Date(), 0);

    expect(windowStart.toISOString()).toBe("2026-08-07T10:00:00.000Z");
    expect(windowEnd.toISOString()).toBe("2026-08-08T02:59:59.000Z");
  });

  it("calcula a janela do dia seguinte quando daysAhead=1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T12:00:00Z"));

    const { windowStart, windowEnd } = brazilSlaWindow(new Date(), 1);

    expect(windowStart.toISOString()).toBe("2026-08-08T10:00:00.000Z");
    expect(windowEnd.toISOString()).toBe("2026-08-09T02:59:59.000Z");
  });

  it("usa o dia de Brasília, não o dia UTC, perto da virada", () => {
    // 01:00 UTC = 22:00 do dia anterior em Brasília (UTC-3).
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-07T01:00:00Z"));

    const { windowStart, windowEnd } = brazilSlaWindow(new Date(), 0);

    expect(windowStart.toISOString()).toBe("2026-08-06T10:00:00.000Z");
    expect(windowEnd.toISOString()).toBe("2026-08-07T02:59:59.000Z");
  });
});

describe("formatBrazilDateTime / formatBrazilTime", () => {
  it("formata um instante UTC como data/hora local de Brasília", () => {
    const instant = new Date("2026-08-07T16:00:00.000Z");
    expect(formatBrazilDateTime(instant)).toBe("2026-08-07 13:00:00");
    expect(formatBrazilTime(instant)).toBe("13:00");
  });
});
