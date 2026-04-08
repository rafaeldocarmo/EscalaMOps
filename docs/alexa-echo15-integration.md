# Integracao Alexa Echo Show 15 (estrutura apartada)

Este guia usa duas partes:

1. **Projeto base EscalaMOps**: endpoint read-only de integracao.
2. **Projeto separado**: `alexa-echo15-skill`.

## 1) Projeto base - configurar endpoint seguro

Ja foi criado:

- `GET /api/integrations/alexa/today-summary`
- Header obrigatorio: `Authorization: Bearer <ALEXA_INTEGRATION_TOKEN>`

Retorno:

```json
{
  "ok": true,
  "summary": {
    "dateKey": "2026-03-18",
    "work": ["Nome 1", "Nome 2"],
    "off": ["Nome 3"],
    "onCall": ["Nome 4 (N2)"]
  }
}
```

### Definir variavel de ambiente no EscalaMOps

No `.env` do projeto base:

```env
ALEXA_INTEGRATION_TOKEN=um_token_bem_forte
```

## 2) Testar endpoint localmente antes da Alexa

Com o app rodando (`npm run dev`), teste:

```bash
curl -H "Authorization: Bearer um_token_bem_forte" http://localhost:3000/api/integrations/alexa/today-summary
```

Se receber `ok: true`, a base esta pronta.

## 3) Projeto separado da Skill

Pasta: `alexa-echo15-skill`

Arquivos principais:

- `src/index.ts` - handler da skill
- `src/apl/todaySummaryDocument.json` - layout do Echo Show 15
- `interaction-model.json` - intents/samples

### Instalar e rodar build

```bash
cd alexa-echo15-skill
npm install
npm run build
```

### Configurar env da skill

Crie um `.env` local com base no `.env.example`:

```env
ESCALAMOPS_BASE_URL=https://seu-dominio.com
ESCALAMOPS_ALEXA_TOKEN=mesmo_valor_de_ALEXA_INTEGRATION_TOKEN
```

## 4) Configurar no Alexa Developer Console

1. Criar **Custom Skill**.
2. Invocation name: `escala mops`.
3. Em **JSON Editor** (Interaction Model), colar `alexa-echo15-skill/interaction-model.json`.
4. Em Endpoint:
   - se usar Lambda: publicar handler `handler` do `src/index.ts` buildado.
   - se usar endpoint HTTPS proprio: adaptar para web service.
5. Em APL:
   - o handler ja envia `RenderDocument` quando dispositivo suportar APL (Echo Show 15).

## 5) Testes ponta a ponta

### Teste 1 - API
- Validar endpoint com token.

### Teste 2 - Skill simulator
- Frase: "abrir escala mops"
- Esperado: fala resumo + tela com 3 blocos (`Escalados`, `Folga`, `Sobreaviso`).

### Teste 3 - Echo Show 15 real
- Dizer: "Alexa, abrir Escala MOPS"
- Conferir se lista bate com dados do dia no sistema.

## 6) Troubleshooting rapido

- `401 Unauthorized` no endpoint:
  - token diferente entre skill e app base.
- Tela nao aparece no Echo Show:
  - dispositivo/skill sem APL habilitado ou resposta sem directive.
- Nomes errados no dia:
  - validar timezone do servidor; integracao usa chave UTC com horario meio-dia para evitar deslocamento.

