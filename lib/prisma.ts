import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

// Vercel Postgres appends ?connection_limit=1 by default which is too low
// for serverless with multiple concurrent functions (crons + API routes).
// Override to allow more concurrent connections per instance.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    datasources: {
        db: {
            url: appendPoolParams(process.env.POSTGRES_PRISMA_URL || ''),
        },
    },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

function appendPoolParams(url: string): string {
    if (!url) return url;
    try {
        const u = new URL(url);
        // Only override if connection_limit is 1 (Vercel default)
        if (u.searchParams.get('connection_limit') === '1') {
            u.searchParams.set('connection_limit', '5');
        }
        // Ensure pool_timeout is reasonable
        if (!u.searchParams.has('pool_timeout') || u.searchParams.get('pool_timeout') === '15') {
            u.searchParams.set('pool_timeout', '30');
        }
        return u.toString();
    } catch {
        return url;
    }
}
