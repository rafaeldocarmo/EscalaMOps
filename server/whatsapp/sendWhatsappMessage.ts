const WHAPI_URL = "https://gate.whapi.cloud/messages/text";
const WHAPI_PIN_URL_BASE = "https://gate.whapi.cloud/messages";


type WhapiSendResponse = {
  sent?: boolean;
  messageId?: string;
  id?: string;
  message?: { id?: string; messageId?: string };
  data?: { messageId?: string; id?: string };
};

export async function sendWhatsappMessage(message: string, to?: string): Promise<{ messageId?: string }> {
  const apiKey = process.env.WHAPI_API_KEY;
  if (!apiKey) {
    console.error("WhatsApp send error: WHAPI_API_KEY is not set");
    return {};
  }

  const destination = to ?? process.env.WHAPI_ADMIN_TO;
  if (!destination) {
    console.error("WhatsApp send error: no destination number provided and WHAPI_TO is not set");
    return {};
  }

  try {
    const res = await fetch(WHAPI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: destination,
        body: message,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("WhatsApp send error", res.status, text);
      return {};
    }

    // WHAPI normalmente retorna metadados do envio; extraímos o MessageID para fazer o pin.
    const data = (await res.json().catch(() => null)) as unknown;
    const whapiData = (data && typeof data === "object" ? (data as WhapiSendResponse) : null) as
      | WhapiSendResponse
      | null;

    // Exemplos reais de resposta WHAPI (varia por endpoint):
    // - { sent: true, message: { id: '...' } }
    // - { messageId: '...' }
    // - { id: '...' }
    const messageId: string | undefined =
      typeof whapiData?.messageId === "string"
        ? whapiData.messageId
        : typeof whapiData?.id === "string"
          ? whapiData.id
          : typeof whapiData?.message?.messageId === "string"
            ? whapiData.message.messageId
            : typeof whapiData?.message?.id === "string"
              ? whapiData.message.id
              : typeof whapiData?.data?.messageId === "string"
                ? whapiData.data.messageId
                : typeof whapiData?.data?.id === "string"
                  ? whapiData.data.id
                  : undefined;

    if (!messageId) {
      // Ajuda a confirmar a estrutura real do retorno da WHAPI durante a validação.
      console.warn("WHAPI send response missing messageId; response:", data);
    }

    return { messageId };
  } catch (error) {
    console.error("WhatsApp send error", error);
    return {};
  }
}

export async function pinWhatsappMessage(
  messageId: string,
  timeInput = process.env.WHAPI_PIN_TIME ?? process.env.WHAPI_PIN_TIME_SECONDS ?? "week"
): Promise<void> {
  const time =
    typeof timeInput === "string" && ["day", "week", "month"].includes(timeInput)
      ? timeInput
      : (() => {
          // Compat: caso venha segundos (ex.: "604800"), converte para a string exigida pela WHAPI.
          const seconds = typeof timeInput === "string" ? Number(timeInput) : NaN;
          if (!Number.isFinite(seconds)) return "month";
          if (seconds <= 90000) return "day"; // ~25h
          if (seconds <= 700000) return "week"; // ~8.1d
          return "month";
        })();

  const apiKey = process.env.WHAPI_API_KEY;
  if (!apiKey) {
    console.error("WhatsApp pin error: WHAPI_API_KEY is not set");
    return;
  }

  try {
    console.log("WHAPI pin request", { messageId, time });

    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(`${WHAPI_PIN_URL_BASE}/${encodeURIComponent(messageId)}/pin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ time }),
      });

      if (res.ok) {
        console.log("WHAPI pin success", { messageId, time, attempt });
        return;
      }

      const text = await res.text();
      console.error("WhatsApp pin error", { attempt, status: res.status, text });

      if (res.status === 404 && attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      return;
    }
  } catch (error) {
    console.error("WhatsApp pin error", error);
  }
}

/**
 * Formats a Brazilian phone like "(11)99999-9999" or "11999999999" to WhatsApp format "5511999999999".
 */
export function phoneToWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return `55${digits}`;
}
