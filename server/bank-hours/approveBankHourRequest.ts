"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { BankHoursActionResult } from "@/types/bankHours";
import type { BankHourRequestStatus, BankHourRequestType } from "@/types/bankHours";

export async function approveBankHourRequest(requestId: string): Promise<BankHoursActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Apenas administradores podem aprovar." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const req = await tx.bankHourRequest.findUnique({
        where: { id: requestId },
        select: { requesterId: true, type: true, date: true, hours: true, status: true },
      });

      if (!req) return { success: false, error: "Solicitação não encontrada." };
      if (req.status !== "PENDING") return { success: false, error: "Esta solicitação não está pendente." };

      const memberId = req.requesterId;
      const type = req.type as BankHourRequestType;
      const hours = req.hours.toNumber();
      const requestDate = req.date;

      // #region agent log
      fetch("http://127.0.0.1:7478/ingest/7f30235a-5aca-4c83-a9a0-a050c1b4b509", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "af02be" },
        body: JSON.stringify({
          sessionId: "af02be",
          runId: "bank_hours_approve_debug_2",
          hypothesisId: "Happrove",
          location: "server/bank-hours/approveBankHourRequest.ts:approveInputs",
          message: "approve inputs loaded",
          data: {
            requestId,
            memberId,
            type,
            hours,
            requestDateIso: requestDate?.toISOString?.() ?? String(requestDate),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion

      // Garante existência da linha de saldo
      await tx.bankHourBalance.upsert({
        where: { memberId },
        create: { memberId, balanceHours: 0 },
        update: {},
      });

      // Lock na linha do saldo para evitar race conditions entre múltiplas aprovações
      const locked = await tx.$queryRaw<
        Array<{
          balance_hours: string | number | null;
        }>
      >`
        SELECT balance_hours
        FROM bank_hour_balances
        WHERE member_id = ${memberId}
        FOR UPDATE
      `;

      const currentBalance = Number(locked[0]?.balance_hours ?? 0);

      const delta = type === "EXTRA_HOURS" ? hours : -hours;

      if (type === "OFF_HOURS" && currentBalance < hours) {
        throw new Error("SALDO_INSUFICIENTE");
      }

      await tx.bankHourTransaction.create({
        data: {
          memberId,
          requestId,
          deltaHours: delta,
        },
      });

      await tx.bankHourBalance.update({
        where: { memberId },
        data: {
          balanceHours: { increment: delta },
        },
      });

      await tx.bankHourRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          adminApprovedAt: new Date(),
        },
      });

      // Regra nova:
      // - Se OFF_HOURS total do dia (aprovado) atingir 8h, vira folga na escala.
      // - Se for menor que 8h, a escala permanece WORK e o destaque (laranja) é exibido no front.
      if (type === "OFF_HOURS") {
        const scheduleYear = requestDate.getUTCFullYear();
        const scheduleMonth = requestDate.getUTCMonth() + 1;

        // Soma de todas as OFF_HOURS já aprovadas neste mesmo dia (a solicitação atual ainda não estava APPROVED).
        const existingApproved = await tx.bankHourRequest.findMany({
          where: {
            requesterId: memberId,
            type: "OFF_HOURS",
            date: requestDate,
            status: "APPROVED",
            id: { not: requestId },
          },
          select: { hours: true },
        });

        const approvedHoursTotal =
          existingApproved.reduce((acc, r) => acc + r.hours.toNumber(), 0) + hours;

        // #region agent log
        fetch("http://127.0.0.1:7478/ingest/7f30235a-5aca-4c83-a9a0-a050c1b4b509", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "af02be" },
          body: JSON.stringify({
            sessionId: "af02be",
            runId: "bank_hours_approve_debug_2",
            hypothesisId: "Happrove",
            location: "server/bank-hours/approveBankHourRequest.ts:offHoursDecision",
            message: "off-hours decision totals",
            data: {
              scheduleYear,
              scheduleMonth,
              existingApprovedCount: existingApproved.length,
              approvedHoursExisting: existingApproved.reduce((acc, r) => acc + r.hours.toNumber(), 0),
              approvedHoursTotal,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion

        if (approvedHoursTotal >= 8 - 1e-9) {
          const schedule = await tx.schedule.findUnique({
            where: { year_month: { year: scheduleYear, month: scheduleMonth } },
            select: { id: true },
          });

          if (schedule) {
            const beforeAssignment = await tx.scheduleAssignment.findFirst({
              where: {
                scheduleId: schedule.id,
                memberId,
                date: requestDate,
              },
              select: { status: true, id: true },
            });

            if (beforeAssignment) {
              await tx.scheduleAssignment.update({
                where: { id: beforeAssignment.id },
                data: { status: "OFF" },
              });
            } else {
              // WORK é implícito (não existe linha). Para garantir OFF no grid, precisamos CRIAR a linha.
              await tx.scheduleAssignment.create({
                data: {
                  scheduleId: schedule.id,
                  memberId,
                  date: requestDate,
                  status: "OFF",
                },
              });
            }

            // #region agent log
            fetch("http://127.0.0.1:7478/ingest/7f30235a-5aca-4c83-a9a0-a050c1b4b509", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "af02be" },
              body: JSON.stringify({
                sessionId: "af02be",
                runId: "bank_hours_approve_debug_2",
                hypothesisId: "Happrove",
                location: "server/bank-hours/approveBankHourRequest.ts:offHoursScheduleUpdate",
                message: "scheduleAssignment updateMany executed",
                data: {
                  scheduleId: schedule.id,
                  beforeStatus: beforeAssignment?.status ?? null,
                  action: beforeAssignment ? "updated" : "created",
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
            // #endregion
          }
        }
      }

      return { success: true };
    });
  } catch (err) {
    if (err instanceof Error && err.message === "SALDO_INSUFICIENTE") {
      return { success: false, error: "Saldo insuficiente no momento da aprovação." };
    }
    return { success: false, error: "Erro ao aprovar solicitação." };
  }
}

