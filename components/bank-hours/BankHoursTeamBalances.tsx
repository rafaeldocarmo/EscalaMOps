"use client";

import { useEffect, useMemo, useState } from "react";
import { getBankHourBalancesForAdmin } from "@/server/bank-hours/getBankHourBalancesForAdmin";
import type { BankHourMemberBalanceRow } from "@/types/bankHours";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMemberName } from "@/lib/formatMemberName";

function formatHours(value: number): string {
  return `${value.toFixed(2)}h`;
}

export function BankHoursTeamBalances() {
  const [rows, setRows] = useState<BankHourMemberBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getBankHourBalancesForAdmin()
      .then(setRows)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setTimeout(() => load(), 0);
    const handler = () => load();
    window.addEventListener("bank-hours-updated", handler);
    return () => window.removeEventListener("bank-hours-updated", handler);
  }, []);

  const totals = useMemo(() => {
    const members = rows.length;
    const pending = rows.reduce((sum, r) => sum + r.pendingRequests, 0);
    const balance = rows.reduce((sum, r) => sum + r.balanceHours, 0);
    return { members, pending, balance };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Saldo da galera</CardTitle>
        {!loading && (
          <p className="text-sm text-muted-foreground">
            Membros: {totals.members} · Solicitações pendentes: {totals.pending} · Saldo total:{" "}
            {formatHours(totals.balance)}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Carregando saldos…</div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            Nenhum membro encontrado para banco de horas.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border/50 bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4 font-semibold">Nome</TableHead>
                <TableHead className="px-4 font-semibold">Nível</TableHead>
                <TableHead className="px-4 font-semibold">Turno</TableHead>
                <TableHead className="px-4 font-semibold text-right">Saldo</TableHead>
                <TableHead className="px-4 font-semibold text-right">Pendentes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.memberId} className={index % 2 === 1 ? "bg-muted/20" : ""}>
                  <TableCell className="px-4 font-medium">{formatMemberName(row.memberName)}</TableCell>
                  <TableCell className="px-4">{row.level}</TableCell>
                  <TableCell className="px-4">{row.shift}</TableCell>
                  <TableCell className="px-4 text-right">
                    <span
                      className={
                        row.balanceHours < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-foreground"
                      }
                    >
                      {formatHours(row.balanceHours)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 text-right">{row.pendingRequests}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

