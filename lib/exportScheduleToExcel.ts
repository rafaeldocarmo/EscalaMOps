import ExcelJS from "exceljs";
import type { ScheduleStateMap } from "@/types/schedule";
import type { TeamMemberRow } from "@/types/team";
import { getDaysInMonth, dateKey, buildScheduleSections } from "./scheduleUtils";

const DAY_COLUMN_WIDTH = 6.3;
const HEADER_ROW_HEIGHT_PT = (77 * 72) / 96;

const FILL_WORK: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF22C55E" },
};

const FILL_OFF: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF9CA3AF" },
};

const FILL_SWAP: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFACC15" },
};

const FILL_SECTION_HEADER: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE4E4E7" },
};

const THIN_BORDER = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

function setCellBorder(cell: ExcelJS.Cell): void {
  // ExcelJS typings vary by version; cast keeps compatibility.
  (cell as unknown as { border: unknown }).border = THIN_BORDER;
}

export async function exportScheduleToExcel(
  year: number,
  month: number,
  members: TeamMemberRow[],
  stateMap: ScheduleStateMap
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const sheetName = `Escala ${month.toString().padStart(2, "0")}-${year}`;
  const ws = wb.addWorksheet(sheetName);

  const daysInMonth = getDaysInMonth(year, month);
  const dayHeaders = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return `${dd}/${mm}/${year}`;
  });
  const headerRow = ["Nome", "Nível", "Turno", ...dayHeaders];
  const sections = buildScheduleSections(members);

  headerRow.forEach((text, col) => {
    const cell = ws.getCell(1, col + 1);
    cell.value = text;
    cell.font = { bold: true };
    setCellBorder(cell);
    if (col >= 3) {
      cell.alignment = { textRotation: 90, horizontal: "center", vertical: "middle" };
    }
  });
  ws.getRow(1).height = HEADER_ROW_HEIGHT_PT;

  let currentRow = 2;
  for (const section of sections) {
    const sectionTitle = `${section.level} - ${section.shift}`;
    ws.mergeCells(currentRow, 1, currentRow, 3);
    const sectionCell = ws.getCell(currentRow, 1);
    sectionCell.value = sectionTitle;
    sectionCell.font = { bold: true };
    sectionCell.fill = FILL_SECTION_HEADER;
    sectionCell.alignment = { vertical: "middle" };
    setCellBorder(sectionCell);
    for (let col = 4; col <= 3 + daysInMonth; col++) {
      const c = ws.getCell(currentRow, col);
      c.fill = FILL_SECTION_HEADER;
      setCellBorder(c);
    }
    currentRow++;

    for (const member of section.members) {
      ws.getCell(currentRow, 1).value = member.name;
      setCellBorder(ws.getCell(currentRow, 1));
      ws.getCell(currentRow, 2).value = member.level;
      setCellBorder(ws.getCell(currentRow, 2));
      ws.getCell(currentRow, 3).value = member.shift;
      setCellBorder(ws.getCell(currentRow, 3));

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = dateKey(year, month, day);
        const status = stateMap[member.id]?.[dateStr] ?? "WORK";
        const col = 3 + day;
        const cell = ws.getCell(currentRow, col);
        cell.value = "";
        setCellBorder(cell);
        if (status === "WORK") {
          cell.fill = FILL_WORK;
        } else if (status === "OFF") {
          cell.fill = FILL_OFF;
        } else {
          cell.fill = FILL_SWAP;
        }
      }
      currentRow++;
    }
  }

  ws.getColumn(1).width = 50;
  ws.getColumn(2).width = 10;
  ws.getColumn(3).width = 8;
  for (let d = 1; d <= daysInMonth; d++) {
    ws.getColumn(3 + d).width = DAY_COLUMN_WIDTH;
  }

  const fileName = `escala-${year}-${month.toString().padStart(2, "0")}.xlsx`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
