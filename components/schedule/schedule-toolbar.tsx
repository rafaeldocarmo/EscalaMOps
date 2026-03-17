"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MonthNavigator } from "./month-navigator";

interface ScheduleToolbarProps {
  scheduleId: string;
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
  scheduleId,
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
    if (month === 1) {
      router.push(`/dashboard/schedule/${year - 1}/12`);
    } else {
      router.push(`/dashboard/schedule/${year}/${month - 1}`);
    }
  };
  const goNext = () => {
    if (month === 12) {
      router.push(`/dashboard/schedule/${year + 1}/1`);
    } else {
      router.push(`/dashboard/schedule/${year}/${month + 1}`);
    }
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
