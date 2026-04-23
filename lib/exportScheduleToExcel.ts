import ExcelJS from "exceljs";
import type { ScheduleStateMap } from "@/types/schedule";
import type { TeamMemberRow } from "@/types/team";
import type { SobreavisoWeek } from "@/server/sobreaviso/getSobreavisoScheduleForMonth";
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

/** Sobreaviso ativo (equiv. `bg-blue-500` na UI) */
const FILL_ONCALL_ACTIVE: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF3B82F6" },
};

/** Dia de transição (equiv. `bg-blue-200`) */
const FILL_ONCALL_TRANSITION: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFBFDBFE" },
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

function toUtcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface SobreavisoGridMember {
  memberId: string;
  memberName: string;
  level: string;
  shiftLabel: string;
  activeDates: Set<string>;
  transitionDates: Set<string>;
}

/** Mesma lógica de `buildSobreavisoMembers` em `sobreaviso-table.tsx`. */
function buildSobreavisoGridMembers(
  weeks: SobreavisoWeek[],
  eligibleMembers: TeamMemberRow[],
): SobreavisoGridMember[] {
  const map = new Map<string, SobreavisoGridMember>();

  for (const m of eligibleMembers) {
    map.set(m.id, {
      memberId: m.id,
      memberName: m.name,
      level: m.levelLabel,
      shiftLabel: m.shiftLabel,
      activeDates: new Set(),
      transitionDates: new Set(),
    });
  }

  for (const w of weeks) {
    if (!map.has(w.memberId)) {
      const fromTeam = eligibleMembers.find((x) => x.id === w.memberId);
      map.set(w.memberId, {
        memberId: w.memberId,
        memberName: w.memberName,
        level: w.level,
        shiftLabel: fromTeam?.shiftLabel ?? "",
        activeDates: new Set(),
        transitionDates: new Set(),
      });
    }
    const member = map.get(w.memberId)!;

    const start = new Date(`${w.startDate}T12:00:00.000Z`);
    const end = new Date(`${w.endDate}T12:00:00.000Z`);

    let d = new Date(start);
    while (d < end) {
      member.activeDates.add(toUtcDateKey(d));
      d = new Date(d.getTime() + 86400000);
    }

    member.transitionDates.add(toUtcDateKey(end));
  }

  for (const member of map.values()) {
    for (const dt of member.transitionDates) {
      member.activeDates.delete(dt);
    }
  }

  const result = Array.from(map.values());
  result.sort((a, b) => {
    if (a.level !== b.level) return a.level.localeCompare(b.level);
    return a.memberName.localeCompare(b.memberName, "pt-BR");
  });
  return result;
}

function groupSobreavisoByLevel(
  members: SobreavisoGridMember[],
): { level: string; members: SobreavisoGridMember[] }[] {
  const groups: { level: string; members: SobreavisoGridMember[] }[] = [];
  let current: { level: string; members: SobreavisoGridMember[] } | null = null;
  for (const m of members) {
    if (!current || current.level !== m.level) {
      current = { level: m.level, members: [] };
      groups.push(current);
    }
    current.members.push(m);
  }
  return groups;
}

export async function exportScheduleToExcel(
  year: number,
  month: number,
  members: TeamMemberRow[],
  stateMap: ScheduleStateMap,
  sobreavisoWeeks: SobreavisoWeek[],
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
      ws.getCell(currentRow, 2).value = member.levelLabel;
      setCellBorder(ws.getCell(currentRow, 2));
      ws.getCell(currentRow, 3).value = member.shiftLabel;
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

  const lastCol = 3 + daysInMonth;
  currentRow += 1;

  ws.mergeCells(currentRow, 1, currentRow, lastCol);
  const sobreTitle = ws.getCell(currentRow, 1);
  sobreTitle.value = "Sobreaviso";
  sobreTitle.font = { bold: true };
  sobreTitle.fill = FILL_SECTION_HEADER;
  sobreTitle.alignment = { vertical: "middle" };
  setCellBorder(sobreTitle);
  for (let col = 2; col <= lastCol; col++) {
    const c = ws.getCell(currentRow, col);
    c.fill = FILL_SECTION_HEADER;
    setCellBorder(c);
  }
  currentRow += 1;

  const sobreEligible = members.filter((m) => m.sobreaviso);
  const sobreGridMembers = buildSobreavisoGridMembers(sobreavisoWeeks, sobreEligible);
  const sobreSections = groupSobreavisoByLevel(sobreGridMembers);

  if (sobreEligible.length === 0) {
    ws.mergeCells(currentRow, 1, currentRow, lastCol);
    const emptyCell = ws.getCell(currentRow, 1);
    emptyCell.value = "Nenhum participante de sobreaviso na equipe.";
    emptyCell.alignment = { vertical: "middle" };
    setCellBorder(emptyCell);
    for (let col = 2; col <= lastCol; col++) {
      const c = ws.getCell(currentRow, col);
      setCellBorder(c);
    }
  } else {
    headerRow.forEach((text, col) => {
      const cell = ws.getCell(currentRow, col + 1);
      cell.value = text;
      cell.font = { bold: true };
      setCellBorder(cell);
      if (col >= 3) {
        cell.alignment = { textRotation: 90, horizontal: "center", vertical: "middle" };
      }
    });
    ws.getRow(currentRow).height = HEADER_ROW_HEIGHT_PT;
    currentRow += 1;

    for (const section of sobreSections) {
      ws.mergeCells(currentRow, 1, currentRow, 3);
      const sectionCell = ws.getCell(currentRow, 1);
      sectionCell.value = section.level;
      sectionCell.font = { bold: true };
      sectionCell.fill = FILL_SECTION_HEADER;
      sectionCell.alignment = { vertical: "middle" };
      setCellBorder(sectionCell);
      for (let col = 4; col <= lastCol; col++) {
        const c = ws.getCell(currentRow, col);
        c.fill = FILL_SECTION_HEADER;
        setCellBorder(c);
      }
      currentRow += 1;

      for (const member of section.members) {
        ws.getCell(currentRow, 1).value = member.memberName;
        setCellBorder(ws.getCell(currentRow, 1));
        ws.getCell(currentRow, 2).value = member.level;
        setCellBorder(ws.getCell(currentRow, 2));
        ws.getCell(currentRow, 3).value = member.shiftLabel;
        setCellBorder(ws.getCell(currentRow, 3));

        for (let day = 1; day <= daysInMonth; day++) {
          const dk = dateKey(year, month, day);
          const col = 3 + day;
          const cell = ws.getCell(currentRow, col);
          cell.value = "";
          setCellBorder(cell);
          if (member.activeDates.has(dk)) {
            cell.fill = FILL_ONCALL_ACTIVE;
          } else if (member.transitionDates.has(dk)) {
            cell.fill = FILL_ONCALL_TRANSITION;
          }
        }
        currentRow += 1;
      }
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
