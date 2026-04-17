"use client";

import React, { useEffect, useState } from "react";
import {
  getWeeklyDashboardBootstrap,
  type WeeklyDashboardBootstrap,
} from "@/server/dashboard/getWeeklyDashboardBootstrap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function displayNameFromFull(name: string): string {
  const trimmed = name.trim();
  const parts = trimmed.split(/\s+/);
  return parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : trimmed;
}

interface WeeklyScheduleViewProps {
  memberName: string;
}

export function WeeklyScheduleView({ memberName }: WeeklyScheduleViewProps) {
  const [bootstrap, setBootstrap] = useState<WeeklyDashboardBootstrap | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWeeklyDashboardBootstrap().then((data) => {
      if (cancelled) return;
      setBootstrap(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const myDisplayName = displayNameFromFull(memberName ?? "");

  if (!bootstrap) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Carregando…
        </CardContent>
      </Card>
    );
  }

  const { weekDays, rows, onCall: onCallSummary } = bootstrap;
  const levelRowCount: Record<string, number> = {};
  for (const row of rows) {
    levelRowCount[row.level] = (levelRowCount[row.level] ?? 0) + 1;
  }

  return (
    <Card>
      <CardHeader>
          <CardTitle className="text-lg">Escala Semanal</CardTitle>
      </CardHeader>
      <CardContent>
          <div className="mb-4">
            <div className="text-sm font-semibold tracking-tight">
              Sobreaviso de Segunda a Quinta
            </div>
            <div className="mt-2 space-y-1">
              {(onCallSummary?.weekSummary ?? []).length > 0 ? (
                (onCallSummary?.weekSummary ?? []).map((s) => (
                  <div key={s.level} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{s.level}:</span>{" "}
                    {s.memberNames.join(", ")}
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">
                  Nenhum sobreaviso (Seg-Quinta).
                </div>
              )}
            </div>

            <div className="mt-3 text-sm font-semibold tracking-tight">
              Sobreaviso de Sexta a Domingo
            </div>
            <div className="mt-2 space-y-1">
              {(onCallSummary?.weekendSummary ?? []).length > 0 ? (
                (onCallSummary?.weekendSummary ?? []).map((s) => (
                  <div key={s.level} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{s.level}:</span>{" "}
                    {s.memberNames.join(", ")}
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">
                  Nenhum sobreaviso (Sexta-Domingo).
                </div>
              )}
            </div>
          </div>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="min-w-[60px] border-r border-border px-2 py-2 text-center font-medium text-muted-foreground">
                  Nível
                </th>
                <th className="min-w-[60px] border-r border-border px-2 py-2 text-center font-medium text-muted-foreground">
                  Turno
                </th>
                {weekDays.map((day) => (
                  <th
                    key={day.dateKey}
                    className="min-w-[100px] border-r border-border px-2 py-2 text-center font-medium text-muted-foreground last:border-r-0"
                  >
                    <div>{day.weekdayLabel}</div>
                    <div className="text-xs font-normal">{day.dayLabel}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => {
                const showLevelCell = rowIdx === 0 || rows[rowIdx - 1].level !== row.level;
                const rowSpan = levelRowCount[row.level];
                const isNewLevel = rowIdx === 0 || rows[rowIdx - 1].level !== row.level;

                return (
                  <tr
                    key={`${row.level}-${row.shift}`}
                    className={`border-b border-border bg-background ${isNewLevel && rowIdx > 0 ? "border-t-2 border-t-muted-foreground/20" : ""}`}
                  >
                    {showLevelCell ? (
                      <td
                        rowSpan={rowSpan}
                        className="border-r border-border px-2 py-2 text-center font-medium align-middle bg-muted/30"
                      >
                        {row.level}
                      </td>
                    ) : null}
                    <td className="border-r border-border px-2 py-2 text-center font-medium align-top w-[60px]">
                      {row.shift}
                    </td>
                    {row.days.map((cell, dayIndex) => (
                      <td
                        key={weekDays[dayIndex]?.dateKey ?? dayIndex}
                        className="border-r border-border p-1.5 align-top last:border-r-0"
                      >
                        <div className="min-h-[2.5rem] rounded p-1.5 gap-1">
                          {cell.names.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            cell.names.map((name) => (
                              <Card
                                key={name}
                                className={`px-2 py-1 text-xs font-medium shadow-none rounded-sm mb-2 ${name === myDisplayName ? "bg-yellow-200 border-yellow-500 text-black" : "bg-background"}`}
                              >
                                {name}
                              </Card>
                            ))
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
