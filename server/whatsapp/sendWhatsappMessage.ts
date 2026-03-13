const WHAPI_URL = "https://gate.whapi.cloud/messages/text";
const WHAPI_TEST_TO = "5511999110057";

/**
 * Sends a WhatsApp text message via WhapiCloud API to a fixed test number.
 * Used for first test integration. Does not throw; logs errors only.
 */
export async function sendWhatsappMessage(message: string): Promise<void> {
  const apiKey = process.env.WHAPI_API_KEY;
  if (!apiKey) {
    console.error("WhatsApp send error: WHAPI_API_KEY is not set");
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
        to: WHAPI_TEST_TO,
        body: message
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
