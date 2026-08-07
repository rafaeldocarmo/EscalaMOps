"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportRowsToCsv, exportRowsToExcel } from "@/lib/exportJiraRows";
import { buildBaseJql, incluiFornecedor } from "@/server/jira/buildJql";
import { GRUPO_SOLUCIONADOR_OPTIONS, PROJETO_OPTIONS, PROJETO_PADRAO_MARCADO, STATUS_OPTIONS } from "@/server/jira/constants";
import { fetchChamadosAViolar } from "@/server/jira/fetchChamadosAViolar";
import { fetchChamadosViolados } from "@/server/jira/fetchChamadosViolados";
import { fetchExtracaoCompleta } from "@/server/jira/fetchExtracaoCompleta";
import type { FlatIssueRow } from "@/server/jira/jiraFields";

type FormatoSaida = "csv" | "excel" | "both";
type AcaoEmAndamento = "completa" | "violar_hoje" | "violar_amanha" | "violados" | null;

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function exportarLinhas(rows: FlatIssueRow[], outputBase: string, formato: FormatoSaida) {
  if (formato === "csv" || formato === "both") exportRowsToCsv(rows, outputBase);
  if (formato === "excel" || formato === "both") void exportRowsToExcel(rows, outputBase);
}

export function JiraExtractionPanel() {
  const [projetos, setProjetos] = useState<Set<string>>(new Set(PROJETO_PADRAO_MARCADO));
  const [grupos, setGrupos] = useState<Set<string>>(new Set(GRUPO_SOLUCIONADOR_OPTIONS));
  const [statusConsiderar, setStatusConsiderar] = useState<Set<string>>(new Set(STATUS_OPTIONS));
  const [formato, setFormato] = useState<FormatoSaida>("both");
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<AcaoEmAndamento>(null);
  const [rows, setRows] = useState<FlatIssueRow[]>([]);
  const [jiraEmail, setJiraEmail] = useState("");

  async function executar(acao: Exclude<AcaoEmAndamento, null>, outputBase: string) {
    if (!jiraEmail) {
      toast.error("Informe o e-mail da conta Jira.");
      return;
    }

    const jqlResult = buildBaseJql({
      projetos: [...projetos],
      grupos: [...grupos],
      statusConsiderar: [...statusConsiderar],
    });
    if (!jqlResult.success) {
      toast.error(jqlResult.error);
      return;
    }
    const jql = jqlResult.jql;

    setAcaoEmAndamento(acao);
    try {
      const fornecedor = incluiFornecedor([...statusConsiderar]);
      const result =
        acao === "completa"
          ? await fetchExtracaoCompleta({ jql, jiraEmail, incluirFornecedor: fornecedor })
          : acao === "violados"
            ? await fetchChamadosViolados({ jqlBase: jql, jiraEmail, incluirFornecedor: fornecedor })
            : await fetchChamadosAViolar({
                jqlBase: jql,
                jiraEmail,
                daysAhead: acao === "violar_amanha" ? 1 : 0,
                incluirFornecedor: fornecedor,
              });

      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const rowsFound = result.rows;

      setRows(rowsFound);
      if (rowsFound.length === 0) {
        toast.warning("Nenhum chamado encontrado para os filtros selecionados.");
        return;
      }

      exportarLinhas(rowsFound, outputBase, formato);
      toast.success(`${rowsFound.length} chamado(s) encontrado(s).`);
    } catch {
      toast.error("Erro inesperado ao consultar o Jira.");
    } finally {
      setAcaoEmAndamento(null);
    }
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="jira-email">E-mail da conta Jira</Label>
            <input
              id="jira-email"
              type="email"
              placeholder="voce@empresa.com"
              className="h-8 w-full max-w-sm rounded-lg border border-input bg-background px-2 text-sm"
              value={jiraEmail}
              onChange={(e) => setJiraEmail(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              E-mail da conta Jira dona do API Token configurado no servidor (pode ser diferente do seu login do
              EscalaMOps). Não é salvo — precisa ser preenchido de novo a cada visita.
            </span>
          </div>

          <FiltroGrupo
            titulo="Projeto"
            opcoes={PROJETO_OPTIONS}
            selecionados={projetos}
            onToggle={(v) => setProjetos((s) => toggleInSet(s, v))}
          />
          <FiltroGrupo
            titulo="Grupo Solucionador"
            opcoes={GRUPO_SOLUCIONADOR_OPTIONS}
            selecionados={grupos}
            onToggle={(v) => setGrupos((s) => toggleInSet(s, v))}
          />
          <FiltroGrupo
            titulo="Status a considerar"
            opcoes={STATUS_OPTIONS}
            selecionados={statusConsiderar}
            onToggle={(v) => setStatusConsiderar((s) => toggleInSet(s, v))}
          />

          <div className="flex items-center gap-2">
            <Label htmlFor="formato-saida">Formato de saída</Label>
            <select
              id="formato-saida"
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
              value={formato}
              onChange={(e) => setFormato(e.target.value as FormatoSaida)}
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="both">Ambos</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button disabled={acaoEmAndamento !== null} onClick={() => executar("completa", "chamados_jira")}>
          Extração completa
        </Button>
        <Button
          variant="outline"
          disabled={acaoEmAndamento !== null}
          onClick={() => executar("violar_hoje", "chamados_a_violar_hoje")}
        >
          Chamados a violar hoje
        </Button>
        <Button
          variant="outline"
          disabled={acaoEmAndamento !== null}
          onClick={() => executar("violar_amanha", "chamados_a_violar_amanha")}
        >
          Chamados a violar amanhã
        </Button>
        <Button
          variant="destructive"
          disabled={acaoEmAndamento !== null}
          onClick={() => executar("violados", "chamados_violados")}
        >
          Chamados violados
        </Button>
      </div>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col}>{col}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={String(row.key ?? i)}>
                    {columns.map((col) => (
                      <TableCell key={col}>{String(row[col] ?? "")}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function toId(...parts: string[]): string {
  return parts.join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function FiltroGrupo({
  titulo,
  opcoes,
  selecionados,
  onToggle,
}: {
  titulo: string;
  opcoes: readonly string[];
  selecionados: Set<string>;
  onToggle: (valor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{titulo}</span>
      <div className="flex flex-wrap gap-4">
        {opcoes.map((opcao) => {
          const id = toId(titulo, opcao);
          return (
            <div key={opcao} className="flex items-center gap-2">
              <Checkbox id={id} checked={selecionados.has(opcao)} onCheckedChange={() => onToggle(opcao)} />
              <Label htmlFor={id} className="font-normal">
                {opcao}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
