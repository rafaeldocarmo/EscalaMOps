"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface MonthNavigatorProps {
  year: number;
  month: number;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
}

export function MonthNavigator({
  year,
  month,
  onPrevious,
  onNext,
  className,
}: MonthNavigatorProps) {
  const label = `${MONTH_NAMES[month - 1]} ${year}`;
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Mês anterior"
        onClick={onPrevious}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[140px] text-center font-medium">{label}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Próximo mês"
        onClick={onNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
