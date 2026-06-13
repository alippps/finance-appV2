import type { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaClient: PrismaClient | undefined;
}

export async function getPrisma() {
  if (!process.env.DATABASE_URL) return null;
  if (globalThis.prismaClient) return globalThis.prismaClient;

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  await prisma.$connect();

  if (process.env.NODE_ENV !== "production") {
    globalThis.prismaClient = prisma;
  }

  return prisma;
}
