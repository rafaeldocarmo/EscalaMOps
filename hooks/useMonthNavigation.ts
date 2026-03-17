import { useCallback } from "react";
import { getNextMonth, getPreviousMonth } from "@/lib/monthNavigation";

export function useMonthNavigation({
  year,
  month,
  onYearChange,
  onMonthChange,
}: {
  year: number;
  month: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
}) {
  const goPrev = useCallback(() => {
    const prev = getPreviousMonth(year, month);
    if (prev.year !== year) onYearChange(prev.year);
    onMonthChange(prev.month);
  }, [year, month, onYearChange, onMonthChange]);

  const goNext = useCallback(() => {
    const next = getNextMonth(year, month);
    if (next.year !== year) onYearChange(next.year);
    onMonthChange(next.month);
  }, [year, month, onYearChange, onMonthChange]);

  return { goPrev, goNext };
}

