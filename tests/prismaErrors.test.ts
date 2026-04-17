import { describe, expect, it } from "vitest";
import { isUniqueConstraintError } from "@/lib/prismaErrors";

describe("isUniqueConstraintError", () => {
  it("detecta P2002", () => {
    expect(isUniqueConstraintError({ code: "P2002" })).toBe(true);
  });

  it("detecta 23505 (Postgres) no objeto ou na causa", () => {
    const inner = Object.assign(new Error("duplicate key"), { code: "23505" });
    expect(isUniqueConstraintError(inner)).toBe(true);
    expect(
      isUniqueConstraintError({
        message: "adapter",
        cause: inner,
      }),
    ).toBe(true);
  });
});
