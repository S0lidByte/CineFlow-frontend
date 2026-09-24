import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { env } from "$env/dynamic/private";
import { building } from "$app/environment";
import * as schema from "./schema";
import { dirname, resolve, isAbsolute, basename, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync } from "node:fs";

export interface DatabaseResolutionOptions {
    rawUrl?: string;
    building?: boolean;
    cwd?: string;
    fileExists?: (path: string) => boolean;
    log?: (msg: string) => void;
}

export function getSqlitePath(databaseUrl: string, cwd: string = process.cwd()): string {
    if (databaseUrl.startsWith("file:")) {
        try {
            return fileURLToPath(databaseUrl);
        } catch {
            return databaseUrl.replace(/^file:\/\//, "");
        }
    }

    // Resolve relative paths against CWD so the DB is always found in the
    // same location regardless of where the process was launched from.
    // Treat paths starting with '/' as absolute POSIX paths (e.g. /riven/data/cineflow.db).
    if (!isAbsolute(databaseUrl) && !databaseUrl.startsWith("/") && databaseUrl !== ":memory:") {
        return resolve(cwd, databaseUrl);
    }

    return databaseUrl;
}

export function resolveSqliteDatabasePath(
    options: DatabaseResolutionOptions = {}
): string | undefined {
    const rawUrl = options.rawUrl;
    const isBuilding = options.building ?? false;
    const cwd = options.cwd ?? process.cwd();
    const fileExists = options.fileExists ?? existsSync;
    const log = options.log ?? ((msg: string) => console.log(msg));

    if (isBuilding) {
        return ":memory:";
    }

    const effectiveUrl = rawUrl || "/riven/data/cineflow.db";
    const targetPath = getSqlitePath(effectiveUrl, cwd);

    if (targetPath === ":memory:") {
        return ":memory:";
    }

    // If the exact target path exists on disk, use it directly
    if (fileExists(targetPath)) {
        return targetPath;
    }

    // If target path does not exist, check for backward-compatible fallback files in the same directory
    const isPosix = targetPath.startsWith("/") && !targetPath.includes(":\\");
    const pathLib = isPosix ? posix : { dirname, basename, join };
    const dir = pathLib.dirname(targetPath);
    const filename = pathLib.basename(targetPath);

    if (filename === "cineflow.db") {
        const legacyPath = pathLib.join(dir, "riven.db");
        if (fileExists(legacyPath)) {
            log(
                `[CineFlow DB] Found existing database at ${legacyPath}; using backward-compatible alias.`
            );
            return legacyPath;
        }
    } else if (filename === "cineflow-local.db") {
        const legacyLocalPath = pathLib.join(dir, "riven-local.db");
        if (fileExists(legacyLocalPath)) {
            log(
                `[CineFlow DB] Found existing database at ${legacyLocalPath}; using backward-compatible alias.`
            );
            return legacyLocalPath;
        }
        const plainLocalPath = pathLib.join(dir, "local.db");
        if (fileExists(plainLocalPath)) {
            log(
                `[CineFlow DB] Found existing database at ${plainLocalPath}; using backward-compatible alias.`
            );
            return plainLocalPath;
        }
    }

    return targetPath;
}

export function ensureSqliteDirectory(databasePath: string | undefined): string | undefined {
    if (!databasePath) {
        return databasePath;
    }

    if (databasePath !== ":memory:") {
        const databaseDir = dirname(databasePath);
        if (databaseDir && databaseDir !== ".") {
            mkdirSync(databaseDir, { recursive: true });
        }
    }

    return databasePath;
}

const rawDatabaseUrl = env.CINEFLOW_DATABASE_URL ?? env.DATABASE_URL ?? env.RIVEN_DATABASE_URL;
const resolvedDatabasePath = resolveSqliteDatabasePath({
    rawUrl: rawDatabaseUrl,
    building
});

export const sqlite = new Database(ensureSqliteDirectory(resolvedDatabasePath));
export const db = drizzle(sqlite, { schema, logger: env.DATABASE_LOGGING === "true" });
