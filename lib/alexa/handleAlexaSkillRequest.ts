import todaySummaryDocument from "@/lib/alexa/apl/todaySummaryDocument.json";
import type { AlexaTodaySummary } from "@/server/integrations/alexa/getTodaySummary";
import { getTodaySummary } from "@/server/integrations/alexa/getTodaySummary";

export type AlexaSkillResponse = {
  version: "1.0";
  sessionAttributes?: Record<string, unknown>;
  response: {
    outputSpeech?: { type: "PlainText"; text: string };
    reprompt?: { outputSpeech: { type: "PlainText"; text: string } };
    shouldEndSession?: boolean;
    directives?: unknown[];
  };
};

type AlexaViewport = { type?: string };

type AlexaEnvelope = {
  session?: { application?: { applicationId?: string } };
  context?: {
    Viewports?: AlexaViewport[];
    System?: {
      device?: { supportedInterfaces?: Record<string, unknown> };
    };
  };
  request: {
    type: string;
    intent?: { name?: string };
  };
};

function toDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

function buildSpeech(summary: AlexaTodaySummary): string {
  const workCount = summary.work.length;
  const offCount = summary.off.length;
  const onCallCount = summary.onCall.length;
  const onCallSpeech =
    onCallCount > 0
      ? `Sobreaviso de hoje: ${summary.onCall.join(", ")}.`
      : "Não há sobreaviso para hoje.";
  return `Resumo de hoje. Escalados: ${workCount}. De folga: ${offCount}. ${onCallSpeech}`;
}

/** Echo Show / HUB often sends APL via Viewports while supportedInterfaces stays empty. */
function supportsApl(context: AlexaEnvelope["context"]): boolean {
  if (context?.System?.device?.supportedInterfaces?.["Alexa.Presentation.APL"]) {
    return true;
  }
  const vps = context?.Viewports;
  if (Array.isArray(vps)) {
    return vps.some((v) => v?.type === "APL");
  }
  return false;
}

async function summaryResponse(context: AlexaEnvelope["context"]): Promise<AlexaSkillResponse> {
  const summary = await getTodaySummary();
  const speech = buildSpeech(summary);
  const response: AlexaSkillResponse = {
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text: speech },
      reprompt: {
        outputSpeech: { type: "PlainText", text: "Você pode pedir: resumo de hoje." },
      },
      shouldEndSession: false,
    },
  };

  if (supportsApl(context)) {
    response.response.directives = [
      {
        type: "Alexa.Presentation.APL.RenderDocument",
        document: todaySummaryDocument,
        datasources: {
          payload: {
            dateLabel: toDateLabel(summary.dateKey),
            sections: [
              { title: "Escalados", items: summary.work.length ? summary.work : ["Nenhum"] },
              { title: "Folga", items: summary.off.length ? summary.off : ["Ninguém"] },
              {
                title: "Sobreaviso",
                items: summary.onCall.length ? summary.onCall : ["Sem sobreaviso"],
              },
            ],
          },
        },
      },
    ];
  }

  return response;
}

function errorResponse(message: string): AlexaSkillResponse {
  return {
    version: "1.0",
    response: {
      outputSpeech: { type: "PlainText", text: message },
      reprompt: {
        outputSpeech: { type: "PlainText", text: "Tente novamente em alguns instantes." },
      },
      shouldEndSession: false,
    },
  };
}

export async function handleAlexaSkillRequest(envelope: AlexaEnvelope): Promise<AlexaSkillResponse> {
  const { request, context } = envelope;

  try {
    switch (request.type) {
      case "LaunchRequest":
        return await summaryResponse(context);

      case "IntentRequest": {
        const name = request.intent?.name;
        if (name === "GetTodaySummaryIntent") {
          return await summaryResponse(context);
        }
        if (name === "AMAZON.HelpIntent") {
          return {
            version: "1.0",
            response: {
              outputSpeech: { type: "PlainText", text: "Peça: qual o resumo de hoje." },
              reprompt: { outputSpeech: { type: "PlainText", text: "Diga: resumo de hoje." } },
              shouldEndSession: false,
            },
          };
        }
        if (name === "AMAZON.CancelIntent" || name === "AMAZON.StopIntent") {
          return {
            version: "1.0",
            response: {
              outputSpeech: { type: "PlainText", text: "Até logo." },
              shouldEndSession: true,
            },
          };
        }
        if (name === "AMAZON.FallbackIntent") {
          return {
            version: "1.0",
            response: {
              outputSpeech: { type: "PlainText", text: "Não entendi. Tente: resumo de hoje." },
              reprompt: { outputSpeech: { type: "PlainText", text: "Tente: resumo de hoje." } },
              shouldEndSession: false,
            },
          };
        }
        return {
          version: "1.0",
          response: {
            outputSpeech: { type: "PlainText", text: "Não entendi. Tente: resumo de hoje." },
            reprompt: { outputSpeech: { type: "PlainText", text: "Tente: resumo de hoje." } },
            shouldEndSession: false,
          },
        };
      }

      case "SessionEndedRequest":
        return { version: "1.0", response: {} };

      default:
        return {
          version: "1.0",
          response: {
            outputSpeech: { type: "PlainText", text: "Peça o resumo de hoje para ver a escala." },
            shouldEndSession: false,
          },
        };
    }
  } catch {
    return errorResponse("Desculpe, ocorreu um erro ao buscar a escala.");
  }
}

export function getRequestApplicationId(envelope: AlexaEnvelope): string | undefined {
  return envelope.session?.application?.applicationId;
}
