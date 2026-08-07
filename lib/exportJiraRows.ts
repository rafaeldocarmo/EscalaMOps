import ExcelJS from "exceljs";

type JiraRow = Record<string, unknown>;

function timestampSuffix(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function collectColumns(rows: JiraRow[]): string[] {
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  return columns;
}

function cellText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Equivalente a `df.to_csv(..., encoding="utf-8-sig")` (jira_extractor.py:650): BOM + UTF-8. */
export function exportRowsToCsv(rows: JiraRow[], fileNameBase: string): void {
  const columns = collectColumns(rows);
  const lines = [
    columns.map(csvEscape).join(","),
    ...rows.map((row) => columns.map((col) => csvEscape(cellText(row[col]))).join(",")),
  ];
  const blob = new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `${fileNameBase}_${timestampSuffix()}.csv`);
}

/** Equivalente a `df.to_excel(...)` (jira_extractor.py:655). */
export async function exportRowsToExcel(rows: JiraRow[], fileNameBase: string): Promise<void> {
  const columns = collectColumns(rows);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Chamados");

  ws.addRow(columns);
  ws.getRow(1).font = { bold: true };
  for (const row of rows) {
    ws.addRow(columns.map((col) => cellText(row[col])));
  }
  columns.forEach((col, i) => {
    ws.getColumn(i + 1).width = Math.min(Math.max(col.length, 12), 40);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `${fileNameBase}_${timestampSuffix()}.xlsx`);
}
