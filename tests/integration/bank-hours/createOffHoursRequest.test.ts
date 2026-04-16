import { createOffHoursRequest } from "@/server/bank-hours/createOffHoursRequest";
import { resolveTeamIdForRead } from "@/lib/multiTeam";
import { sendWhatsappMessage } from "@/server/whatsapp/sendWhatsappMessage";
import { prisma } from "@/lib/prisma";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockResolvedSession, resetAuthMock } from "@/tests/helpers/auth-mock";
import { createMemberFixture, sessionAsPlainUser } from "@/tests/helpers/session-factory";
import {
  createMemberTeamWithoutSchedule,
  createOffAssignmentOnDate,
  createOffHoursRequestTestContext,
  createPendingOffHoursRequestSameDay,
  destroyMemberTeamOnly,
  destroyOffHoursRequestTestContext,
} from "@/tests/helpers/off-hours-request-context";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDatabaseUrl)("createOffHoursRequest (integração)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2099-06-10T10:00:00.000Z"));
    resetAuthMock();
    vi.mocked(resolveTeamIdForRead).mockReset();
    vi.mocked(resolveTeamIdForRead).mockResolvedValue(null);
    vi.mocked(sendWhatsappMessage).mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetAuthMock();
  });

  it("rejeita quando não há sessão", async () => {
    mockResolvedSession(null);
    const result = await createOffHoursRequest("2099-06-20", 4, "Folga por banco");
    expect(result).toEqual({
      success: false,
      error: "Faça login e vincule seu celular para solicitar banco de horas.",
    });
  });

  it("rejeita quando o usuário não tem membro vinculado", async () => {
    mockResolvedSession(sessionAsPlainUser({ member: null }));
    const result = await createOffHoursRequest("2099-06-20", 4, "Folga por banco");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Faça login e vincule seu celular para solicitar banco de horas.");
  });

  it("rejeita dados inválidos (Zod): data, horas e justificativa", async () => {
    mockResolvedSession(
      sessionAsPlainUser({
        member: createMemberFixture({ id: "any-member" }),
      }),
    );

    const badDate = await createOffHoursRequest("não-é-data", 4, "Folga por banco");
    expect(badDate.success).toBe(false);
    expect(badDate.error).toBe("Data inválida.");

    const tooManyHours = await createOffHoursRequest("2099-06-20", 9, "Folga por banco");
    expect(tooManyHours.success).toBe(false);
    expect(tooManyHours.error).toContain("máximo 8");

    const shortJust = await createOffHoursRequest("2099-06-20", 4, "x");
    expect(shortJust.success).toBe(false);
    expect(shortJust.error).toBe("Justificativa é obrigatória");
  });

  it("rejeita data que não é futura", async () => {
    mockResolvedSession(
      sessionAsPlainUser({
        member: createMemberFixture({ id: "m-past" }),
      }),
    );
    const result = await createOffHoursRequest("2099-06-05", 4, "Folga por banco");
    expect(result).toEqual({
      success: false,
      error: "A data da folga precisa ser no futuro.",
    });
  });

  it("rejeita quando não existe escala do mês para a equipe resolvida", async () => {
    const ctx = await createMemberTeamWithoutSchedule();
    try {
      vi.mocked(resolveTeamIdForRead).mockResolvedValue(ctx.teamId);
      mockResolvedSession(
        sessionAsPlainUser({
          member: createMemberFixture({ id: ctx.memberId, name: "Membro sem escala" }),
        }),
      );
      const result = await createOffHoursRequest("2099-06-20", 4, "Folga por banco");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Escala do mês não encontrada. Gere/salve a escala antes.");
    } finally {
      await destroyMemberTeamOnly(ctx);
    }
  });

  it("rejeita quando o dia selecionado já é folga (OFF) na escala", async () => {
    const ctx = await createOffHoursRequestTestContext();
    try {
      vi.mocked(resolveTeamIdForRead).mockResolvedValue(ctx.teamId);
      mockResolvedSession(
        sessionAsPlainUser({
          member: createMemberFixture({ id: ctx.memberId, name: "Membro BH Teste" }),
        }),
      );
      await createOffAssignmentOnDate(ctx);
      const result = await createOffHoursRequest(ctx.dateKey, 4, "Folga por banco");
      expect(result.success).toBe(false);
      expect(result.error).toBe("A data selecionada não é um dia de trabalho para você.");
    } finally {
      await destroyOffHoursRequestTestContext(ctx);
    }
  });

  it("rejeita quando soma de horas do dia ultrapassa 8h", async () => {
    const ctx = await createOffHoursRequestTestContext();
    try {
      vi.mocked(resolveTeamIdForRead).mockResolvedValue(ctx.teamId);
      mockResolvedSession(
        sessionAsPlainUser({
          member: createMemberFixture({ id: ctx.memberId, name: "Membro BH Teste" }),
        }),
      );
      await createPendingOffHoursRequestSameDay(ctx, 6);
      const result = await createOffHoursRequest(ctx.dateKey, 3, "Folga por banco");
      expect(result.success).toBe(false);
      expect(result.error).toContain("8h/dia");
    } finally {
      await destroyOffHoursRequestTestContext(ctx);
    }
  });

  it("rejeita quando o saldo de banco de horas é insuficiente", async () => {
    const ctx = await createOffHoursRequestTestContext({ balanceHours: 2 });
    try {
      vi.mocked(resolveTeamIdForRead).mockResolvedValue(ctx.teamId);
      mockResolvedSession(
        sessionAsPlainUser({
          member: createMemberFixture({ id: ctx.memberId, name: "Membro BH Teste" }),
        }),
      );
      const result = await createOffHoursRequest(ctx.dateKey, 4, "Folga por banco");
      expect(result).toEqual({
        success: false,
        error: "Saldo insuficiente de banco de horas.",
      });
    } finally {
      await destroyOffHoursRequestTestContext(ctx);
    }
  });

  it("cria solicitação PENDING e notifica admin (WhatsApp mockado)", async () => {
    const ctx = await createOffHoursRequestTestContext();
    try {
      vi.mocked(resolveTeamIdForRead).mockResolvedValue(ctx.teamId);
      mockResolvedSession(
        sessionAsPlainUser({
          member: createMemberFixture({ id: ctx.memberId, name: "Membro BH Teste" }),
        }),
      );
      const before = await prisma.bankHourRequest.count({
        where: { requesterId: ctx.memberId, type: "OFF_HOURS" },
      });
      const result = await createOffHoursRequest(ctx.dateKey, 4, "Folga por banco");
      expect(result).toEqual({ success: true });
      const after = await prisma.bankHourRequest.count({
        where: { requesterId: ctx.memberId, type: "OFF_HOURS" },
      });
      expect(after).toBe(before + 1);
      expect(vi.mocked(sendWhatsappMessage)).toHaveBeenCalledTimes(1);
      const msg = vi.mocked(sendWhatsappMessage).mock.calls[0]?.[0] as string;
      expect(msg).toContain("Membro BH Teste");
      expect(msg).toContain("4");
    } finally {
      await destroyOffHoursRequestTestContext(ctx);
    }
  });
});
