import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { env } from "$env/dynamic/private";
import { building } from "$app/environment";
import * as schema from "./schema";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

function getSqlitePath(databaseUrl: string): string {
    if (databaseUrl.startsWith("file:")) {
        return fileURLToPath(databaseUrl);
    }

    return databaseUrl;
}

function ensureSqliteDirectory(databaseUrl: string): string {
    const sqlitePath = getSqlitePath(databaseUrl);

    if (sqlitePath !== ":memory:") {
        const databaseDir = dirname(sqlitePath);
        if (databaseDir && databaseDir !== ".") {
            mkdirSync(databaseDir, { recursive: true });
        }
    }

    return sqlitePath;
}

const databaseUrl = env.DATABASE_URL ?? (building ? ":memory:" : undefined);

if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
}

const sqlite = new Database(ensureSqliteDirectory(databaseUrl));
export const db = drizzle(sqlite, { schema, logger: env.DATABASE_LOGGING === "true" });
