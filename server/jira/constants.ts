// Constantes portadas de extração-Jira/jira_extractor.py e jira_gui.py —
// mantidas em sincronia com o app Python enquanto ele ainda existir.

export const PROJETO_INC = "Central de Incidentes";
export const PROJETO_PDST = "Abertura de Chamados";

export const PROJETO_OPTIONS = ["Abertura de Chamados", "Central de Incidentes"] as const;
export const PROJETO_PADRAO_MARCADO: ReadonlySet<string> = new Set(["Central de Incidentes"]);

export const GRUPO_SOLUCIONADOR_OPTIONS = [
  "CLBR-TI-OPS-OGS-SOLAR-SALESFORCE-N2",
  "CLBR-TI-OPS-OGS SOLAR SALESFORCE",
  "CLBR-TI-OPS-PROD SOLAR SALESFORCE",
] as const;

export const STATUS_OPTIONS = [
  "Triagem",
  "Aguardando Suporte",
  "Aguardando Fornecedor",
  "Reaberto",
  "Em atendimento",
  "Aguardando Cliente",
  "Aberto",
  "Encaminhado",
  "Encerrado",
  "Resolvido",
  "Cancelado",
] as const;

export const FORNECEDOR_STATUS = "Aguardando Fornecedor";

export const ORDER_BY_FIXO = "cf[10419] ASC";

// Campos padrão extraídos de cada chamado na Extração completa.
export const DEFAULT_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "priority",
  "assignee",
  "reporter",
  "project",
  "created",
  "updated",
  "resolutiondate",
];

// O ID do campo de SLA "Tempo de Resolução" varia por esquema de projeto:
// PDST usa customfield_10419, INC usa customfield_10629. Usa-se o primeiro
// destes que estiver preenchido em cada chamado.
export const SLA_RESOLUTION_FIELDS = ["customfield_10419", "customfield_10629"];

export const FORNECEDOR_RESPONSAVEL_FIELDS = ["customfield_31880", "customfield_16762"];

// Apenas chamados nestes status entram no cálculo de "chamados a violar no dia".
export const VIOLAR_STATUSES = ["Aguardando Suporte", "Encaminhado", "Em atendimento"];

// Janela em que o SLA corre (definida pelo time: 07:00 às 23:59, fuso de
// Brasília fixo em UTC-3, sem horário de verão desde 2019).
export const SLA_WINDOW_START = { hour: 7, minute: 0, second: 0 };
export const SLA_WINDOW_END = { hour: 23, minute: 59, second: 59 };
export const BRAZIL_TZ_OFFSET_MINUTES = -3 * 60;
