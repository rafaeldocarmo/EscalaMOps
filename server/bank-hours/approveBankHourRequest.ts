"use server";

import { auth } from "@/auth";
import { isStaffAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import type { BankHoursActionResult } from "@/types/bankHours";
import type { BankHourRequestStatus, BankHourRequestType } from "@/types/bankHours";

export async function approveBankHourRequest(requestId: string): Promise<BankHoursActionResult> {
  const session = await auth();
  if (!session?.user || !isStaffAdmin(session)) {
    return { success: false, error: "Apenas administradores podem aprovar." };
  }

  const scopeCheck = await prisma.bankHourRequest.findUnique({
    where: { id: requestId },
    include: { requester: { select: { teamId: true } } },
  });
  if (!scopeCheck) {
    return { success: false, error: "Solicitação não encontrada." };
  }
  if (
    session.user.role === "ADMIN_TEAM" &&
    session.user.managedTeamId &&
    scopeCheck.requester.teamId !== session.user.managedTeamId
  ) {
    return { success: false, error: "Acesso negado." };
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

        if (approvedHoursTotal >= 8 - 1e-9) {
          const memberTeam = await tx.teamMember.findUnique({
            where: { id: memberId },
            select: { teamId: true },
          });
          const schedule = memberTeam?.teamId
            ? await tx.schedule.findUnique({
                where: {
                  teamId_year_month: {
                    teamId: memberTeam.teamId,
                    year: scheduleYear,
                    month: scheduleMonth,
                  },
                },
                select: { id: true },
              })
            : await tx.schedule.findFirst({
                where: { year: scheduleYear, month: scheduleMonth },
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

