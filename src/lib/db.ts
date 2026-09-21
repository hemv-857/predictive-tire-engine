import { PrismaClient } from '@prisma/client'

const DB_CACHE_KEY = 'prisma_v2'

const globalForPrisma = globalThis as unknown as {
  prismaCache?: Record<string, PrismaClient>
}

if (!globalForPrisma.prismaCache) {
  globalForPrisma.prismaCache = {}
}

export const db =
  globalForPrisma.prismaCache[DB_CACHE_KEY] ??
  (globalForPrisma.prismaCache[DB_CACHE_KEY] = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'query'] : ['error', 'warn'],
  }))
