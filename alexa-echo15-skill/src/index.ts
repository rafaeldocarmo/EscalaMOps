import Alexa, { HandlerInput } from "ask-sdk-core";
import type { RequestHandler, ErrorHandler } from "ask-sdk-core";
import axios from "axios";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore json import for skill runtime bundle
import todaySummaryDocument from "./apl/todaySummaryDocument.json";

interface TodaySummary {
  dateKey: string;
  work: string[];
  off: string[];
  onCall: string[];
}

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function fetchTodaySummary(): Promise<TodaySummary> {
  const baseUrl = getEnv("ESCALAMOPS_BASE_URL");
  const token = getEnv("ESCALAMOPS_ALEXA_TOKEN");
  const url = `${baseUrl.replace(/\/$/, "")}/api/integrations/alexa/today-summary`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10000,
  });
  if (!res.data?.ok) throw new Error(res.data?.error ?? "Integration error");
  return res.data.summary as TodaySummary;
}

function buildSpeech(summary: TodaySummary): string {
  const workCount = summary.work.length;
  const offCount = summary.off.length;
  const onCallCount = summary.onCall.length;
  const onCallSpeech =
    onCallCount > 0
      ? `Sobreaviso de hoje: ${summary.onCall.join(", ")}.`
      : "Não há sobreaviso para hoje.";
  return `Resumo de hoje. Escalados: ${workCount}. De folga: ${offCount}. ${onCallSpeech}`;
}

function supportsApl(input: HandlerInput): boolean {
  const interfaces = input.requestEnvelope.context?.System?.device?.supportedInterfaces;
  return !!interfaces?.["Alexa.Presentation.APL"];
}

function toDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y}`;
}

const LaunchRequestHandler: RequestHandler = {
  canHandle(input) {
    return Alexa.getRequestType(input.requestEnvelope) === "LaunchRequest";
  },
  async handle(input) {
    const summary = await fetchTodaySummary();
    const speech = buildSpeech(summary);
    const response = input.responseBuilder.speak(speech).reprompt("Você pode pedir: resumo de hoje.");

    if (supportsApl(input)) {
      response.addDirective({
        type: "Alexa.Presentation.APL.RenderDocument",
        document: todaySummaryDocument,
        datasources: {
          payload: {
            dateLabel: toDateLabel(summary.dateKey),
            sections: [
              { title: "Escalados", items: summary.work.length ? summary.work : ["Nenhum"] },
              { title: "Folga", items: summary.off.length ? summary.off : ["Ninguém"] },
              { title: "Sobreaviso", items: summary.onCall.length ? summary.onCall : ["Sem sobreaviso"] }
            ]
          }
        }
      });
    }

    return response.getResponse();
  }
};

const GetTodaySummaryIntentHandler: RequestHandler = {
  canHandle(input) {
    return (
      Alexa.getRequestType(input.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(input.requestEnvelope) === "GetTodaySummaryIntent"
    );
  },
  async handle(input) {
    return LaunchRequestHandler.handle(input);
  }
};

const HelpIntentHandler: RequestHandler = {
  canHandle(input) {
    return (
      Alexa.getRequestType(input.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(input.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(input) {
    return input.responseBuilder
      .speak("Peça: qual o resumo de hoje.")
      .reprompt("Diga: resumo de hoje.")
      .getResponse();
  }
};

const CancelAndStopIntentHandler: RequestHandler = {
  canHandle(input) {
    return (
      Alexa.getRequestType(input.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(input.requestEnvelope) === "AMAZON.CancelIntent" ||
        Alexa.getIntentName(input.requestEnvelope) === "AMAZON.StopIntent")
    );
  },
  handle(input) {
    return input.responseBuilder.speak("Até logo.").getResponse();
  }
};

const FallbackIntentHandler: RequestHandler = {
  canHandle(input) {
    return (
      Alexa.getRequestType(input.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(input.requestEnvelope) === "AMAZON.FallbackIntent"
    );
  },
  handle(input) {
    return input.responseBuilder
      .speak("Não entendi. Tente: resumo de hoje.")
      .reprompt("Tente: resumo de hoje.")
      .getResponse();
  }
};

const SessionEndedRequestHandler: RequestHandler = {
  canHandle(input) {
    return Alexa.getRequestType(input.requestEnvelope) === "SessionEndedRequest";
  },
  handle(input) {
    return input.responseBuilder.getResponse();
  }
};

const GenericErrorHandler: ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(input, error) {
    console.error("Alexa skill error:", error);
    return input.responseBuilder
      .speak("Desculpe, ocorreu um erro ao buscar a escala.")
      .reprompt("Tente novamente em alguns instantes.")
      .getResponse();
  }
};

export const handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    GetTodaySummaryIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(GenericErrorHandler)
  .lambda();

