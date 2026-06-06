import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as analyticsSchema from './schema/analytics';
import * as clinicalSchema from './schema/clinical';
import * as complianceSchema from './schema/compliance';
import * as findingArchetypeSchema from './schema/finding_archetype';
import * as identitySchema from './schema/identity';
import * as ingestionSchema from './schema/ingestion';
import * as rulesSchema from './schema/rules';
import * as riskManagementSchema from './schema/risk_management';
import * as notificationsSchema from './schema/notifications';

export const dbSchema = {
    ...identitySchema, ...clinicalSchema, ...ingestionSchema, ...rulesSchema,
    ...analyticsSchema, ...complianceSchema, ...riskManagementSchema,
    ...findingArchetypeSchema, ...notificationsSchema,
};

let _db: NodePgDatabase<typeof dbSchema> | null = null;
let _pool: Pool | null = null;

function getDatabaseUrl(): string {
    const raw = process.env.DATABASE_URL?.trim();
    const url = raw?.replace(/^"|"$/g, '');
    if (!url) throw new Error('DATABASE_URL is missing. Ensure .env is loaded before accessing the database and that DATABASE_URL is configured.');
    return url;
}

function createPool(): Pool {
    if (!_pool) _pool = new Pool({ connectionString: getDatabaseUrl() });
    return _pool;
}

export function getDb(): NodePgDatabase<typeof dbSchema> {
    if (!_db) _db = drizzle(createPool(), { schema: dbSchema });
    return _db;
}

export const db = new Proxy({} as NodePgDatabase<typeof dbSchema>, {
    get(_target, prop) { const instance = getDb(); return (instance as any)[prop]; },
});

export * from './schema/analytics';
export * from './schema/clinical';
export * from './schema/compliance';
export * from './schema/finding_archetype';
export * from './schema/identity';
export * from './schema/ingestion';
export * from './schema/rules';
export * from './schema/risk_management';
export * from './schema/notifications';
