import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Suite usa a implementação real; `tests/setup.ts` mocka este módulo globalmente. */
vi.unmock("@/server/whatsapp/sendWhatsappMessage");

import {
  phoneToWhatsApp,
  pinWhatsappMessage,
  sendWhatsappMessage,
} from "@/server/whatsapp/sendWhatsappMessage";

describe("phoneToWhatsApp", () => {
  it("prefixa 55 quando não há DDI", () => {
    expect(phoneToWhatsApp("11987654321")).toBe("5511987654321");
    expect(phoneToWhatsApp("(11) 98765-4321")).toBe("5511987654321");
  });

  it("mantém dígitos quando já começa com 55", () => {
    expect(phoneToWhatsApp("5511987654321")).toBe("5511987654321");
  });
});

describe("sendWhatsappMessage", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("retorna {} e não chama fetch sem WHAPI_API_KEY", async () => {
    delete process.env.WHAPI_API_KEY;
    process.env.WHAPI_ADMIN_TO = "5511999999999";

    const result = await sendWhatsappMessage("Olá");

    expect(result).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retorna {} sem destino (sem to e sem WHAPI_ADMIN_TO)", async () => {
    process.env.WHAPI_API_KEY = "test-key";
    delete process.env.WHAPI_ADMIN_TO;

    const result = await sendWhatsappMessage("Olá");

    expect(result).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("usa o parâmetro to e envia POST com Authorization e body", async () => {
    process.env.WHAPI_API_KEY = "secret-key";
    delete process.env.WHAPI_ADMIN_TO;

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "msg-abc" }),
      text: async () => "",
    });

    const result = await sendWhatsappMessage("texto", "5511888888888");

    expect(result).toEqual({ messageId: "msg-abc" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("whapi.cloud");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer secret-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      to: "5511888888888",
      body: "texto",
    });
  });

  it("retorna {} quando a API responde não-OK", async () => {
    process.env.WHAPI_API_KEY = "k";
    process.env.WHAPI_ADMIN_TO = "5511999999999";

    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "error",
    });

    const result = await sendWhatsappMessage("x");

    expect(result).toEqual({});
  });

  it("retorna {} quando fetch lança", async () => {
    process.env.WHAPI_API_KEY = "k";
    process.env.WHAPI_ADMIN_TO = "5511999999999";

    fetchMock.mockRejectedValue(new Error("network"));

    const result = await sendWhatsappMessage("x");

    expect(result).toEqual({});
  });

  it("extrai messageId de formatos de JSON comuns da WHAPI", async () => {
    process.env.WHAPI_API_KEY = "k";
    process.env.WHAPI_ADMIN_TO = "5511999999999";

    const cases = [
      { body: { messageId: "m1" }, expected: "m1" },
      { body: { id: "m2" }, expected: "m2" },
      { body: { message: { messageId: "m3" } }, expected: "m3" },
      { body: { message: { id: "m4" } }, expected: "m4" },
      { body: { data: { messageId: "m5" } }, expected: "m5" },
    ] as const;

    for (const { body, expected } of cases) {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => body,
        text: async () => "",
      });
      const r = await sendWhatsappMessage("ping");
      expect(r.messageId).toBe(expected);
    }
  });
});

describe("pinWhatsappMessage", () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("não chama fetch sem WHAPI_API_KEY", async () => {
    delete process.env.WHAPI_API_KEY;

    await pinWhatsappMessage("mid-1", "week");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("faz POST de pin com tempo literal day|week|month", async () => {
    process.env.WHAPI_API_KEY = "pin-key";

    fetchMock.mockResolvedValue({ ok: true });

    await pinWhatsappMessage("msg-xyz", "day");

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/msg-xyz/pin");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ time: "day" });
  });
});
