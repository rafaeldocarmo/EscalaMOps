import { approveSwap } from "@/server/swaps/approveSwap";
import { prisma } from "@/lib/prisma";
import { SwapRequestStatus } from "@/lib/generated/prisma/enums";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockResolvedSession, resetAuthMock } from "@/tests/helpers/auth-mock";
import {
  createMemberFixture,
  sessionAsAdmin,
  sessionAsAdminTeam,
  sessionAsPlainUser,
} from "@/tests/helpers/session-factory";
import {
  insertOffSwapLegadoRequest,
  insertOffSwapTwoMemberRequest,
} from "@/tests/helpers/approve-swap-context";
import {
  OFF_SWAP_ORIGINAL_KEY,
  OFF_SWAP_TARGET_KEY,
  createOffSwapLegadoContext,
  createOffSwapTwoMemberContext,
  destroyOffSwapLegadoContext,
  destroyOffSwapTwoMemberContext,
  parseSwapDateUtc,
} from "@/tests/helpers/off-swap-test-context";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDatabaseUrl)("approveSwap (integração)", () => {
  beforeEach(() => {
    process.env.TZ = "UTC";
    resetAuthMock();
  });

  afterEach(() => {
    resetAuthMock();
  });

  it("rejeita quando o usuário não é admin de staff", async () => {
    mockResolvedSession(
      sessionAsPlainUser({
        member: createMemberFixture({ id: "m-staff" }),
      }),
    );
    const result = await approveSwap("clidfake000000000000000000");
    expect(result).toEqual({
      success: false,
      error: "Apenas administradores podem aprovar.",
    });
  });

  it("rejeita quando a solicitação não existe", async () => {
    mockResolvedSession(sessionAsAdmin());
    const result = await approveSwap("clid000000000000000000000000");
    expect(result).toEqual({ success: false, error: "Solicitação não encontrada." });
  });

  it("ADMIN_TEAM: nega quando o solicitante não é da equipe gerida", async () => {
    const ctx = await createOffSwapLegadoContext();
    const otherTeam = await prisma.team.create({
      data: { name: `mops-approve-other-${Date.now()}`, isDefault: false },
    });
    try {
      const swap = await insertOffSwapLegadoRequest(ctx, SwapRequestStatus.PENDING);
      mockResolvedSession(sessionAsAdminTeam(otherTeam.id));
      const result = await approveSwap(swap.id);
      expect(result).toEqual({ success: false, error: "Acesso negado." });
    } finally {
      await prisma.scheduleSwapRequest.deleteMany({ where: { requesterId: ctx.requesterId } });
      await destroyOffSwapLegadoContext(ctx);
      await prisma.team.deleteMany({ where: { id: otherTeam.id } });
    }
  });

  it("rejeita quando já está APPROVED", async () => {
    const ctx = await createOffSwapLegadoContext();
    try {
      const swap = await insertOffSwapLegadoRequest(ctx, SwapRequestStatus.APPROVED);
      mockResolvedSession(sessionAsAdmin());
      const result = await approveSwap(swap.id);
      expect(result).toEqual({
        success: false,
        error: "Esta solicitação já foi aprovada.",
      });
    } finally {
      await destroyOffSwapLegadoContext(ctx);
    }
  });

  it("rejeita quando está REJECTED ou CANCELLED", async () => {
    const ctx = await createOffSwapLegadoContext();
    try {
      const rejected = await insertOffSwapLegadoRequest(ctx, SwapRequestStatus.REJECTED);
      mockResolvedSession(sessionAsAdmin());
      const r1 = await approveSwap(rejected.id);
      expect(r1.error).toBe("Esta solicitação não pode mais ser aprovada.");
    } finally {
      await prisma.scheduleSwapRequest.deleteMany({ where: { requesterId: ctx.requesterId } });
      await destroyOffSwapLegadoContext(ctx);
    }

    const ctx2 = await createOffSwapLegadoContext();
    try {
      const cancelled = await insertOffSwapLegadoRequest(ctx2, SwapRequestStatus.CANCELLED);
      mockResolvedSession(sessionAsAdmin());
      const r2 = await approveSwap(cancelled.id);
      expect(r2.error).toBe("Esta solicitação não pode mais ser aprovada.");
    } finally {
      await destroyOffSwapLegadoContext(ctx2);
    }
  });

  it("OFF legado: rejeita status diferente de PENDING", async () => {
    const ctx = await createOffSwapLegadoContext();
    try {
      const swap = await insertOffSwapLegadoRequest(ctx, SwapRequestStatus.WAITING_SECOND_USER);
      mockResolvedSession(sessionAsAdmin());
      const result = await approveSwap(swap.id);
      expect(result).toEqual({
        success: false,
        error: "Status inválido para aprovação.",
      });
    } finally {
      await destroyOffSwapLegadoContext(ctx);
    }
  });

  it("OFF com membro: exige SECOND_USER_ACCEPTED", async () => {
    const ctx = await createOffSwapTwoMemberContext();
    try {
      const swap = await insertOffSwapTwoMemberRequest(ctx, SwapRequestStatus.PENDING);
      mockResolvedSession(sessionAsAdmin());
      const result = await approveSwap(swap.id);
      expect(result).toEqual({
        success: false,
        error: "O outro membro ainda precisa aceitar a troca.",
      });
    } finally {
      await destroyOffSwapTwoMemberContext(ctx);
    }
  });

  it("OFF legado: aprova, atualiza escala e marca solicitação como APPROVED", async () => {
    const ctx = await createOffSwapLegadoContext();
    try {
      const swap = await insertOffSwapLegadoRequest(ctx, SwapRequestStatus.PENDING);
      mockResolvedSession(sessionAsAdmin());
      const result = await approveSwap(swap.id);
      expect(result).toEqual({ success: true });

      const updated = await prisma.scheduleSwapRequest.findUnique({ where: { id: swap.id } });
      expect(updated?.status).toBe("APPROVED");
      expect(updated?.adminApprovedAt).not.toBeNull();

      const offNoOrig = await prisma.scheduleAssignment.findFirst({
        where: {
          scheduleId: ctx.scheduleId,
          memberId: ctx.requesterId,
          date: parseSwapDateUtc(OFF_SWAP_ORIGINAL_KEY),
          status: "OFF",
        },
      });
      expect(offNoOrig).toBeNull();

      const offOnTarget = await prisma.scheduleAssignment.findFirst({
        where: {
          scheduleId: ctx.scheduleId,
          memberId: ctx.requesterId,
          date: parseSwapDateUtc(OFF_SWAP_TARGET_KEY),
          status: "OFF",
        },
      });
      expect(offOnTarget).not.toBeNull();
    } finally {
      await destroyOffSwapLegadoContext(ctx);
    }
  });

  it("OFF legado: segunda aprovação na mesma solicitação falha", async () => {
    const ctx = await createOffSwapLegadoContext();
    try {
      const swap = await insertOffSwapLegadoRequest(ctx, SwapRequestStatus.PENDING);
      mockResolvedSession(sessionAsAdmin());
      await approveSwap(swap.id);
      const second = await approveSwap(swap.id);
      expect(second).toEqual({
        success: false,
        error: "Esta solicitação já foi aprovada.",
      });
    } finally {
      await destroyOffSwapLegadoContext(ctx);
    }
  });

  it("OFF com membro: aprova após SECOND_USER_ACCEPTED e troca folgas", async () => {
    const ctx = await createOffSwapTwoMemberContext();
    try {
      const swap = await insertOffSwapTwoMemberRequest(ctx, SwapRequestStatus.SECOND_USER_ACCEPTED);
      mockResolvedSession(sessionAsAdmin());
      const result = await approveSwap(swap.id);
      expect(result).toEqual({ success: true });

      const updated = await prisma.scheduleSwapRequest.findUnique({ where: { id: swap.id } });
      expect(updated?.status).toBe("APPROVED");

      const requesterOnTarget = await prisma.scheduleAssignment.findFirst({
        where: {
          scheduleId: ctx.scheduleId,
          memberId: ctx.requesterId,
          date: parseSwapDateUtc(OFF_SWAP_TARGET_KEY),
          status: "OFF",
        },
      });
      const targetOnOrig = await prisma.scheduleAssignment.findFirst({
        where: {
          scheduleId: ctx.scheduleId,
          memberId: ctx.targetMemberId,
          date: parseSwapDateUtc(OFF_SWAP_ORIGINAL_KEY),
          status: "OFF",
        },
      });
      expect(requesterOnTarget).not.toBeNull();
      expect(targetOnOrig).not.toBeNull();
    } finally {
      await destroyOffSwapTwoMemberContext(ctx);
    }
  });

  it("ADMIN_TEAM: aprova quando o solicitante pertence à equipe gerida", async () => {
    const ctx = await createOffSwapLegadoContext();
    try {
      const swap = await insertOffSwapLegadoRequest(ctx, SwapRequestStatus.PENDING);
      mockResolvedSession(sessionAsAdminTeam(ctx.teamId));
      const result = await approveSwap(swap.id);
      expect(result).toEqual({ success: true });
      const updated = await prisma.scheduleSwapRequest.findUnique({ where: { id: swap.id } });
      expect(updated?.status).toBe("APPROVED");
    } finally {
      await destroyOffSwapLegadoContext(ctx);
    }
  });
});
