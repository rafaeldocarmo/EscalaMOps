const WHAPI_URL = "https://gate.whapi.cloud/messages/text";


export async function sendWhatsappMessage(message: string, to?: string): Promise<void> {
  const apiKey = process.env.WHAPI_API_KEY;
  if (!apiKey) {
    console.error("WhatsApp send error: WHAPI_API_KEY is not set");
    return;
  }

  const destination = process.env.WHAPI_ADMIN_TO;
  if (!destination) {
    console.error("WhatsApp send error: no destination number provided and WHAPI_TO is not set");
    return;
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
      return;
    }
  } catch (error) {
    console.error("WhatsApp send error", error);
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
