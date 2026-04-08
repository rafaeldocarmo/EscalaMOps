# Alexa Echo Show 15 — integração sem Lambda (HTTPS no Next.js)

A skill fala com o próprio app **Escala MOPS** via **HTTPS**: o endpoint da skill é uma rota `POST` no Next (Vercel), sem AWS Lambda.

## Endpoint da skill

Em produção (exemplo):

`https://escala-mops.vercel.app/api/alexa/skill`

No **Alexa Developer Console** → sua skill → **Endpoint** → **HTTPS** → cole essa URL exata (com `https://`, sem barra final obrigatória).

## Variáveis de ambiente no Vercel

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `ALEXA_SKILL_ID` | Recomendada | ID da skill (ex.: `amzn1.ask.skill.xxx`). Se definida, o servidor só aceita requisições com esse `applicationId`. |
| `ALEXA_SKIP_SKILL_SIGNATURE_VERIFY` | Não | `true` **somente em dev local** para testar POST manual sem assinatura. **Nunca** em produção. |

A rota da skill **não** usa o token `ALEXA_INTEGRATION_TOKEN`; ela consulta o banco diretamente (`getTodaySummary`). O endpoint `GET /api/integrations/alexa/today-summary` continua disponível se você quiser um backend separado (ex.: outra skill ou ferramenta) com Bearer.

## Certificação e segurança

- Em produção o servidor valida a assinatura das requisições com o pacoute `alexa-verifier` (cadeia de certificados Amazon + `Signature`).
- Defina `ALEXA_SKILL_ID` para evitar que outra skill aponte acidentalmente para o mesmo URL.
- Garanta que o app na Vercel tem acesso ao banco (Prisma) nas invocações da skill.

## Console Alexa — checklist

1. Criar skill custom em português (BR), mesma conta do dispositivo.
2. Colar `interaction-model.json` (intents: `GetTodaySummaryIntent`, etc.).
3. Endpoint **HTTPS** → URL `/api/alexa/skill`.
4. Na primeira publicação/teste, seguir o fluxo de **Skill validation** da Amazon.
5. Testar no **simulador** e no **Echo Show 15** logado na mesma conta da skill (modo desenvolvimento ou publicada).

## Projeto `alexa-echo15-skill` (opcional)

A pasta `alexa-echo15-skill/` continua útil como referência do modelo de interação e do documento APL; a lógica espelhada no app está em:

- `app/api/alexa/skill/route.ts`
- `lib/alexa/handleAlexaSkillRequest.ts`
- `lib/alexa/apl/todaySummaryDocument.json`

Se não usar Lambda, você **não** precisa de `ESCALAMOPS_BASE_URL` nem `ESCALAMOPS_ALEXA_TOKEN` na skill — isso era para o fluxo em que a Lambda chamava o `GET` de integração.
