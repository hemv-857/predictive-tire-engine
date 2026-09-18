import { PrismaClient } from '@prisma/client'

// Cache key includes a version stamp so schema changes bust the singleton
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
    log: ['error', 'warn'],
  }))