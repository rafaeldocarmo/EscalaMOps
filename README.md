This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Autenticação (NextAuth + Prisma + shadcn)

- **Login**: Google OAuth ou email/senha.
- **Fluxo**: Após login, o usuário é direcionado para informar o número de celular (obrigatório).
- **BD**: PostgreSQL com Prisma. Sessões em banco.

### Setup

1. **Variáveis de ambiente**  
   Copie `.env.example` para `.env` e preencha:
   - `DATABASE_URL` – connection string do PostgreSQL
   - `AUTH_SECRET` – gere com `npx auth secret`
   - `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` – [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth 2.0)
   - `JIRA_BASE_URL`, `JIRA_API_TOKEN` – credenciais (compartilhadas pelo time) usadas pela extração de chamados em `/dashboard/jira`; veja abaixo

2. **Banco e Prisma**  
   ```bash
   npx prisma migrate dev
   ```

3. **Build**  
   Execute sempre a partir da pasta do projeto (`escala-mops`). Se aparecer erro de "Module not found" para `@/`, verifique se não há outro `package-lock.json` em diretório pai (o Next.js pode usar essa pasta como raiz).

## Extração de chamados Jira (`/dashboard/jira`)

Qualquer usuário logado pode buscar chamados do Jira Cloud (via REST API) e
exportar em CSV/Excel: extração completa, chamados a violar hoje/amanhã e
chamados com SLA já violado — mesma lógica do antigo app Python
`extração-Jira`, portada para dentro do EscalaMOps. É uma feature stateless
(consulta o Jira ao vivo a cada clique, sem tabela própria no banco).

Autenticação no Jira usa Basic Auth (e-mail + API Token), e os dois **têm
que ser da mesma conta Jira**. Como só existe um `JIRA_API_TOKEN`
compartilhado (variável de ambiente), o e-mail correspondente a essa conta
é digitado na própria tela (`/dashboard/jira`) em vez de fixo no `.env` —
não é a mesma coisa que o login do EscalaMOps da pessoa, e não é salvo em
lugar nenhum: precisa ser preenchido de novo a cada visita à tela.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
