"use client";

import { Calendar, CalendarClock, FileText, ShieldCheck, Clock3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function MyScheduleQuickActions({
  onSwapOff,
  onSwapQueue,
  onSwapHistory,
  onSwapOnCall,
  onSwapTurn,
  onBankHours,
  onCallEnabled,
}: {
  onSwapOff: () => void;
  onSwapQueue: () => void;
  onSwapHistory: () => void;
  onSwapOnCall: () => void;
  onSwapTurn: () => void;
  onBankHours: () => void;
  onCallEnabled: boolean;
}) {
  return (
    <Card className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
          Ações Rápidas
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="group h-auto flex-col gap-2 py-3 cursor-pointer border-border hover:border-red-500 hover:bg-red-500/10 hover:text-red-600"
          onClick={onSwapOff}
        >
          <Calendar className="h-5 w-5 text-muted-foreground group-hover:text-red-600 transition-colors" />
          <span className="text-xs font-medium text-foreground group-hover:text-red-600 transition-colors">
            Trocar Folga
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="group h-auto flex-col gap-2 py-3 cursor-pointer border-border hover:border-red-500 hover:bg-red-500/10 hover:text-red-600"
          onClick={onSwapQueue}
        >
          <CalendarClock className="h-5 w-5 text-muted-foreground group-hover:text-red-600 transition-colors" />
          <span className="text-xs font-medium text-foreground group-hover:text-red-600 transition-colors">
            Trocar FDS
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="group h-auto flex-col gap-2 py-3 cursor-pointer border-border hover:border-red-500 hover:bg-red-500/10 hover:text-red-600"
          onClick={onSwapHistory}
        >
          <FileText className="h-5 w-5 text-muted-foreground group-hover:text-red-600 transition-colors" />
          <span className="text-xs font-medium text-foreground group-hover:text-red-600 transition-colors">
            Ver Solicitações
          </span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!onCallEnabled}
          className="group h-auto flex-col gap-2 py-3 cursor-pointer border-border hover:border-blue-500 hover:bg-blue-500/10 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={onSwapOnCall}
        >
          <ShieldCheck className="h-5 w-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
          <span className="text-xs font-medium text-foreground group-hover:text-blue-600 transition-colors">
            Trocar Sobreaviso
          </span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="group h-auto flex-col gap-2 py-3 cursor-pointer border-border hover:border-purple-500 hover:bg-purple-500/10 hover:text-purple-600"
          onClick={onSwapTurn}
        >
          <CalendarClock className="h-5 w-5 text-muted-foreground group-hover:text-purple-600 transition-colors" />
          <span className="text-xs font-medium text-foreground group-hover:text-purple-600 transition-colors">
            Trocar Turno
          </span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="group h-auto flex-col gap-2 py-3 cursor-pointer border-border hover:border-indigo-500 hover:bg-indigo-500/10 hover:text-indigo-600"
          onClick={onBankHours}
        >
          <Clock3 className="h-5 w-5 text-muted-foreground group-hover:text-indigo-600 transition-colors" />
          <span className="text-xs font-medium text-foreground group-hover:text-indigo-600 transition-colors">
            Banco de Horas
          </span>
        </Button>
      </CardContent>
    </Card>
  );
}

