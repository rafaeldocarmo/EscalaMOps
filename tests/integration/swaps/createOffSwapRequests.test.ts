import { createOffSwapRequest } from "@/server/swaps/createOffSwapRequest";
import { createOffSwapWithMemberRequest } from "@/server/swaps/createOffSwapWithMemberRequest";
import { sendWhatsappMessage } from "@/server/whatsapp/sendWhatsappMessage";
import { resolveTeamIdForRead } from "@/lib/multiTeam";
import { prisma } from "@/lib/prisma";
import { Level } from "@/lib/generated/prisma/enums";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockResolvedSession, resetAuthMock } from "@/tests/helpers/auth-mock";
import { createMemberFixture, sessionAsPlainUser } from "@/tests/helpers/session-factory";
import {
  OFF_SWAP_ORIGINAL_KEY,
  OFF_SWAP_TARGET_KEY,
  createOffSwapLegadoContext,
  createOffSwapTwoMemberContext,
  destroyOffSwapLegadoContext,
  destroyOffSwapTwoMemberContext,
  parseSwapDateUtc,
} from "@/tests/helpers/off-swap-test-context";
import { AssignmentStatus } from "@/lib/generated/prisma/enums";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDatabaseUrl)("createOffSwapRequest / createOffSwapWithMemberRequest (integração)", () => {
  beforeEach(() => {
    process.env.TZ = "UTC";
    resetAuthMock();
    vi.mocked(resolveTeamIdForRead).mockReset();
    vi.mocked(resolveTeamIdForRead).mockResolvedValue(null);
    vi.mocked(sendWhatsappMessage).mockClear();
  });

  afterEach(() => {
    resetAuthMock();
  });

  describe("createOffSwapRequest (OFF legado)", () => {
    it("rejeita sem sessão ou sem membro vinculado", async () => {
      mockResolvedSession(null);
      expect(await createOffSwapRequest(OFF_SWAP_ORIGINAL_KEY, OFF_SWAP_TARGET_KEY, "Motivo")).toEqual({
        success: false,
        error: "Faça login e vincule seu celular para solicitar trocas.",
      });

      mockResolvedSession(sessionAsPlainUser({ member: null }));
      expect(await createOffSwapRequest(OFF_SWAP_ORIGINAL_KEY, OFF_SWAP_TARGET_KEY, "Motivo")).toEqual({
        success: false,
        error: "Faça login e vincule seu celular para solicitar trocas.",
      });
    });

    it("rejeita quando as datas são iguais", async () => {
      mockResolvedSession(
        sessionAsPlainUser({ member: createMemberFixture({ id: "m1" }) }),
      );
      const result = await createOffSwapRequest(OFF_SWAP_ORIGINAL_KEY, OFF_SWAP_ORIGINAL_KEY, "Motivo");
      expect(result).toEqual({ success: false, error: "As datas devem ser diferentes." });
    });

    it("rejeita quando falta escala do mês", async () => {
      const ctx = await createOffSwapLegadoContext();
      try {
        vi.mocked(resolveTeamIdForRead).mockResolvedValue(ctx.teamId);
        await prisma.scheduleAssignment.deleteMany({ where: { scheduleId: ctx.scheduleId } });
        await prisma.schedule.delete({ where: { id: ctx.scheduleId } });
        mockResolvedSession(
          sessionAsPlainUser({
            member: createMemberFixture({ id: ctx.requesterId }),
          }),
        );
        const result = await createOffSwapRequest(OFF_SWAP_ORIGINAL_KEY, OFF_SWAP_TARGET_KEY, "Motivo");
        expect(result.success).toBe(false);
        expect(result.error).toBe("Escala do mês não encontrada para uma das datas.");
      } finally {
        await prisma.teamMember.deleteMany({ where: { teamId: ctx.teamId } });
        await prisma.team.deleteMany({ where: { id: ctx.teamId } });
      }
    });

    it("rejeita quando a data original não é folga", async () => {
      const ctx = await createOffSwapLegadoContext();
      try {
        vi.mocked(resolveTeamIdForRead).mockResolvedValue(ctx.teamId);
        await prisma.scheduleAssignment.deleteMany({ where: { scheduleId: ctx.scheduleId } });
        mockResolvedSession(
          sessionAsPlainUser({
            member: createMemberFixture({ id: ctx.requesterId }),
          }),
        );
        const result = await createOffSwapRequest(OFF_SWAP_ORIGINAL_KEY, OFF_SWAP_TARGET_KEY, "Motivo");
        expect(result).toEqual({
          success: false,
          error: "A data original não é um dia de folga para você.",
        });
      } finally {
        await destroyOffSwapLegadoContext(ctx);
      }
    });

    it("rejeita quando a data de destino já é folga", async () => {
      const ctx = await createOffSwapLegadoContext();
      try {
        vi.mocked(resolveTeamIdForRead).mockResolvedValue(ctx.teamId);
        await prisma.scheduleAssignment.create({
          data: {
            scheduleId: ctx.scheduleId,
            memberId: ctx.requesterId,
            date: parseSwapDateUtc(OFF_SWAP_TARGET_KEY),
            status: AssignmentStatus.OFF,
          },
        });
        mockResolvedSession(
          sessionAsPlainUser({
            member: createMemberFixture({ id: ctx.requesterId }),
          }),
        );
        const result = await createOffSwapRequest(OFF_SWAP_ORIGINAL_KEY, OFF_SWAP_TARGET_KEY, "Motivo");
        expect(result).toEqual({
          success: false,
          error: "A data de destino já é folga para você.",
        });
      } finally {
        await destroyOffSwapLegadoContext(ctx);
      }
    });

    it("cria OFF_SWAP pendente e envia WhatsApp ao admin", async () => {
      const ctx = await createOffSwapLegadoContext();
      try {
        vi.mocked(resolveTeamIdForRead).mockResolvedValue(ctx.teamId);
        mockResolvedSession(
          sessionAsPlainUser({
            member: createMemberFixture({ id: ctx.requesterId, name: "Solicitante" }),
          }),
        );
        const before = await prisma.scheduleSwapRequest.count({
          where: { requesterId: ctx.requesterId, type: "OFF_SWAP" },
        });
        const result = await createOffSwapRequest(OFF_SWAP_ORIGINAL_KEY, OFF_SWAP_TARGET_KEY, "Troca de folga");
        expect(result).toEqual({ success: true });
        expect(
          await prisma.scheduleSwapRequest.count({
            where: { requesterId: ctx.requesterId, type: "OFF_SWAP" },
          }),
        ).toBe(before + 1);
        expect(vi.mocked(sendWhatsappMessage)).toHaveBeenCalledTimes(1);
      } finally {
        await destroyOffSwapLegadoContext(ctx);
      }
    });
  });

  describe("createOffSwapWithMemberRequest (OFF com colega)", () => {
    it("rejeita sem sessão ou sem membro", async () => {
      mockResolvedSession(null);
      expect(
        await createOffSwapWithMemberRequest(OFF_SWAP_ORIGINAL_KEY, "clxxxxxxxxxxxxxxxxxxxxxx", OFF_SWAP_TARGET_KEY),
      ).toEqual({
        success: false,
        error: "Faça login e vincule seu celular para solicitar trocas.",
      });
    });

    it("rejeita troca com o próprio membro", async () => {
      const ctx = await createOffSwapTwoMemberContext();
      try {
        mockResolvedSession(
          sessionAsPlainUser({
            member: createMemberFixture({ id: ctx.requesterId }),
          }),
        );
        const result = await createOffSwapWithMemberRequest(
          OFF_SWAP_ORIGINAL_KEY,
          ctx.requesterId,
          OFF_SWAP_TARGET_KEY,
        );
        expect(result).toEqual({ success: false, error: "Não é possível trocar com você mesmo." });
      } finally {
        await destroyOffSwapTwoMemberContext(ctx);
      }
    });

    it("rejeita quando as datas coincidem", async () => {
      const ctx = await createOffSwapTwoMemberContext();
      try {
        mockResolvedSession(
          sessionAsPlainUser({
            member: createMemberFixture({ id: ctx.requesterId }),
          }),
        );
        const result = await createOffSwapWithMemberRequest(
          OFF_SWAP_ORIGINAL_KEY,
          ctx.targetMemberId,
          OFF_SWAP_ORIGINAL_KEY,
        );
        expect(result).toEqual({
          success: false,
          error: "As datas devem ser diferentes para efetivar a troca.",
        });
      } finally {
        await destroyOffSwapTwoMemberContext(ctx);
      }
    });

    it("rejeita quando o colega não existe", async () => {
      mockResolvedSession(
        sessionAsPlainUser({
          member: createMemberFixture({ id: "membro-inexistente-no-db" }),
        }),
      );
      const result = await createOffSwapWithMemberRequest(
        OFF_SWAP_ORIGINAL_KEY,
        "clid00000000000000000000",
        OFF_SWAP_TARGET_KEY,
      );
      expect(result).toEqual({ success: false, error: "Membro não encontrado." });
    });

    it("rejeita quando nível ou turno do colega difere", async () => {
      const ctx = await createOffSwapTwoMemberContext();
      try {
        await prisma.teamMember.update({
          where: { id: ctx.targetMemberId },
          data: { level: Level.N2 },
        });
        mockResolvedSession(
          sessionAsPlainUser({
            member: createMemberFixture({ id: ctx.requesterId }),
          }),
        );
        const result = await createOffSwapWithMemberRequest(
          OFF_SWAP_ORIGINAL_KEY,
          ctx.targetMemberId,
          OFF_SWAP_TARGET_KEY,
        );
        expect(result).toEqual({
          success: false,
          error: "Só é possível trocar com alguém do mesmo nível e turno.",
        });
      } finally {
        await destroyOffSwapTwoMemberContext(ctx);
      }
    });

    it("rejeita quando a data de destino não é folga do colega", async () => {
      const ctx = await createOffSwapTwoMemberContext();
      try {
        await prisma.scheduleAssignment.deleteMany({
          where: { memberId: ctx.targetMemberId, date: parseSwapDateUtc(OFF_SWAP_TARGET_KEY) },
        });
        mockResolvedSession(
          sessionAsPlainUser({
            member: createMemberFixture({ id: ctx.requesterId }),
          }),
        );
        const result = await createOffSwapWithMemberRequest(
          OFF_SWAP_ORIGINAL_KEY,
          ctx.targetMemberId,
          OFF_SWAP_TARGET_KEY,
        );
        expect(result).toEqual({
          success: false,
          error: "A data de destino não é folga para o colega selecionado.",
        });
      } finally {
        await destroyOffSwapTwoMemberContext(ctx);
      }
    });

    it("rejeita quando já existe solicitação em aberto com o mesmo colega", async () => {
      const ctx = await createOffSwapTwoMemberContext();
      try {
        mockResolvedSession(
          sessionAsPlainUser({
            member: createMemberFixture({ id: ctx.requesterId }),
          }),
        );
        const first = await createOffSwapWithMemberRequest(
          OFF_SWAP_ORIGINAL_KEY,
          ctx.targetMemberId,
          OFF_SWAP_TARGET_KEY,
          "Primeira",
        );
        expect(first).toEqual({ success: true });
        const second = await createOffSwapWithMemberRequest(
          OFF_SWAP_ORIGINAL_KEY,
          ctx.targetMemberId,
          OFF_SWAP_TARGET_KEY,
          "Segunda",
        );
        expect(second).toEqual({
          success: false,
          error: "Já existe uma solicitação de troca em aberto com este membro.",
        });
      } finally {
        await destroyOffSwapTwoMemberContext(ctx);
      }
    });

    it("cria OFF_SWAP aguardando o segundo membro", async () => {
      const ctx = await createOffSwapTwoMemberContext();
      try {
        mockResolvedSession(
          sessionAsPlainUser({
            member: createMemberFixture({ id: ctx.requesterId }),
          }),
        );
        const before = await prisma.scheduleSwapRequest.count({
          where: { requesterId: ctx.requesterId, targetMemberId: ctx.targetMemberId },
        });
        const result = await createOffSwapWithMemberRequest(
          OFF_SWAP_ORIGINAL_KEY,
          ctx.targetMemberId,
          OFF_SWAP_TARGET_KEY,
          "Troca combinada",
        );
        expect(result).toEqual({ success: true });
        expect(
          await prisma.scheduleSwapRequest.count({
            where: { requesterId: ctx.requesterId, targetMemberId: ctx.targetMemberId },
          }),
        ).toBe(before + 1);
        const created = await prisma.scheduleSwapRequest.findFirst({
          where: { requesterId: ctx.requesterId, targetMemberId: ctx.targetMemberId },
          orderBy: { createdAt: "desc" },
        });
        expect(created?.status).toBe("WAITING_SECOND_USER");
        expect(created?.type).toBe("OFF_SWAP");
      } finally {
        await destroyOffSwapTwoMemberContext(ctx);
      }
    });
  });
});
