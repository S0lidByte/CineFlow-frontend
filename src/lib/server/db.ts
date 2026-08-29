import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { env } from "$env/dynamic/private";
import { building } from "$app/environment";
import * as schema from "./schema";
import { dirname, resolve, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

function getSqlitePath(databaseUrl: string): string {
    if (databaseUrl.startsWith("file:")) {
        return fileURLToPath(databaseUrl);
    }

    // Resolve relative paths against CWD so the DB is always found in the
    // same location regardless of where the process was launched from.
    if (!isAbsolute(databaseUrl) && databaseUrl !== ":memory:") {
        return resolve(process.cwd(), databaseUrl);
    }

    return databaseUrl;
}

function ensureSqliteDirectory(databaseUrl: string | undefined): string | undefined {
    if (!databaseUrl) {
        return databaseUrl;
    }

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

export const sqlite = new Database(ensureSqliteDirectory(databaseUrl));
export const db = drizzle(sqlite, { schema, logger: env.DATABASE_LOGGING === "true" });
