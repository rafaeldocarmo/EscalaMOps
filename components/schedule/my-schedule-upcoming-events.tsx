"use client";

import { Briefcase, Coffee, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MyScheduleUpcomingEvents({
  nextWorkLabel,
  nextWorkSubtitle,
  nextOffLabel,
  nextOffSubtitle,
  nextOnCallLabel,
  nextOnCallSubtitle,
}: {
  nextWorkLabel: string | null;
  nextWorkSubtitle: string | null;
  nextOffLabel: string | null;
  nextOffSubtitle: string | null;
  nextOnCallLabel: string | null;
  nextOnCallSubtitle: string | null;
}) {
  return (
    <Card className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground">
          Próximos Eventos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {nextWorkLabel ? (
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-600">
              <Briefcase className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{nextWorkLabel}</p>
              <p className="text-xs text-muted-foreground">{nextWorkSubtitle ?? ""}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum dia de trabalho próximo.</p>
        )}

        {nextOffLabel ? (
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-600">
              <Coffee className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{nextOffLabel}</p>
              <p className="text-xs text-muted-foreground">{nextOffSubtitle ?? ""}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma folga próxima.</p>
        )}

        {nextOnCallLabel && (
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{nextOnCallLabel}</p>
              <p className="text-xs text-muted-foreground">{nextOnCallSubtitle ?? ""}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

