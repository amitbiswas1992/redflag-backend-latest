import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as analyticsSchema from './schema/analytics';
import * as clinicalSchema from './schema/clinical';
import * as complianceSchema from './schema/compliance';
import * as identitySchema from './schema/identity';
import * as ingestionSchema from './schema/ingestion';
import * as rulesSchema from './schema/rules';

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
const databaseUrl = rawDatabaseUrl?.replace(/^"|"$/g, '');

if (!databaseUrl) {
    throw new Error(
        'DATABASE_URL is missing. Ensure .env is loaded before importing @app/db and that DATABASE_URL is configured.',
    );
}

const pool = new Pool({
    connectionString: databaseUrl,
});

export const dbSchema = {
    ...identitySchema,
    ...clinicalSchema,
    ...ingestionSchema,
    ...rulesSchema,
    ...analyticsSchema,
    ...complianceSchema,
};

export const db = drizzle(pool, { schema: dbSchema });

export * from './schema/analytics';
export * from './schema/clinical';
export * from './schema/compliance';
export * from './schema/identity';
export * from './schema/ingestion';
export * from './schema/rules';

