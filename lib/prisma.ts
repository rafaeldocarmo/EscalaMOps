import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizePgConnectionString } from "@/lib/normalizePgConnectionString";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({
  connectionString: normalizePgConnectionString(process.env.DATABASE_URL ?? ""),
});

function createPrismaClient(): PrismaClient {
  return new PrismaClient({ adapter });
}

/** Delegates novos podem faltar se o singleton foi criado antes do `prisma generate` (HMR / dev server). */
function hasCurrentSchemaDelegates(client: PrismaClient): boolean {
  return typeof (client as unknown as { teamLevel?: { findMany?: unknown } }).teamLevel?.findMany === "function";
}

function resolvePrismaClient(): PrismaClient {
  const isProd = process.env.NODE_ENV === "production";

  // Em dev, não reutilizar `globalThis`: após `prisma generate` o bundle novo ainda pode ler um
  // client antigo que referencia colunas removidas → P2022 ("column does not exist").
  if (!isProd) {
    globalForPrisma.prisma = undefined;
    return createPrismaClient();
  }

  const cached = globalForPrisma.prisma;
  if (cached && hasCurrentSchemaDelegates(cached)) {
    return cached;
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
}

export const prisma: PrismaClient = resolvePrismaClient();
