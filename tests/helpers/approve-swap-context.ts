import { prisma } from "@/lib/prisma";
import type { SwapRequestStatus } from "@/lib/generated/prisma/enums";
import {
  OFF_SWAP_ORIGINAL_KEY,
  OFF_SWAP_TARGET_KEY,
  type OffSwapLegadoContext,
  type OffSwapTwoMemberContext,
  parseSwapDateUtc,
} from "@/tests/helpers/off-swap-test-context";

/**
 * Registro `ScheduleSwapRequest` OFF legado (`targetMemberId` nulo) para testes de `approveSwap`.
 */
export async function insertOffSwapLegadoRequest(
  ctx: OffSwapLegadoContext,
  status: SwapRequestStatus,
  justification = "Aprovação teste",
) {
  return prisma.scheduleSwapRequest.create({
    data: {
      type: "OFF_SWAP",
      requesterId: ctx.requesterId,
      targetMemberId: null,
      originalDate: parseSwapDateUtc(OFF_SWAP_ORIGINAL_KEY),
      targetDate: parseSwapDateUtc(OFF_SWAP_TARGET_KEY),
      status,
      justification,
    },
  });
}

/**
 * OFF com membro (duas folgas trocadas). Use `SECOND_USER_ACCEPTED` para aprovação válida.
 */
export async function insertOffSwapTwoMemberRequest(
  ctx: OffSwapTwoMemberContext,
  status: SwapRequestStatus,
  justification = "Troca com colega",
) {
  return prisma.scheduleSwapRequest.create({
    data: {
      type: "OFF_SWAP",
      requesterId: ctx.requesterId,
      targetMemberId: ctx.targetMemberId,
      originalDate: parseSwapDateUtc(OFF_SWAP_ORIGINAL_KEY),
      targetDate: parseSwapDateUtc(OFF_SWAP_TARGET_KEY),
      status,
      justification,
    },
  });
}
