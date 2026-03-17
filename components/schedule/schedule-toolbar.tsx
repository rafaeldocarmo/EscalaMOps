"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MonthNavigator } from "./month-navigator";
import { getNextMonth, getPreviousMonth } from "@/lib/monthNavigation";

interface ScheduleToolbarProps {
  year: number;
  month: number;
  onGenerate: () => void;
  onSave: () => void;
  onClear: () => void;
  generateDisabled?: boolean;
  saveLoading?: boolean;
  generateLoading?: boolean;
  clearLoading?: boolean;
  rightContent?: React.ReactNode;
}

export function ScheduleToolbar({
  year,
  month,
  onGenerate,
  onSave,
  onClear,
  generateDisabled = false,
  saveLoading = false,
  generateLoading = false,
  clearLoading = false,
  rightContent,
}: ScheduleToolbarProps) {
  const router = useRouter();

  const goPrev = () => {
    const prev = getPreviousMonth(year, month);
    router.push(`/dashboard/schedule/${prev.year}/${prev.month}`);
  };
  const goNext = () => {
    const next = getNextMonth(year, month);
    router.push(`/dashboard/schedule/${next.year}/${next.month}`);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <MonthNavigator year={year} month={month} onPrevious={goPrev} onNext={goNext} />
        <Button
          variant="destructive"
          size="sm"
          onClick={onClear}
          disabled={clearLoading || saveLoading || generateLoading}
        >
          {clearLoading ? "Limpando…" : "Limpar tabela"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onGenerate}
          disabled={generateLoading || generateDisabled}
        >
          {generateLoading ? "Gerando…" : "Gerar Escala Automática"}
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saveLoading}
        >
          {saveLoading ? "Salvando…" : "Salvar Alterações"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {rightContent}
      </div>
    </div>
  );
}
