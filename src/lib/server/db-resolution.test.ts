import assert from "node:assert/strict";
import { resolveSqliteDatabasePath, getSqlitePath, ensureSqliteDirectory } from "./db";
import { resolve } from "node:path";

console.log("Running SQLite database path resolution & fallback tests...");

// 1. Building mode returns :memory:
{
    const path = resolveSqliteDatabasePath({ building: true });
    assert.equal(path, ":memory:", "Building mode must return :memory:");
}

// 2. Explicit memory URL
{
    const path = resolveSqliteDatabasePath({ rawUrl: ":memory:" });
    assert.equal(path, ":memory:", "Explicit :memory: must return :memory:");
}

// 3. Default path when rawUrl is undefined (defaults to /riven/data/cineflow.db)
{
    const fakeExists = () => false;
    const path = resolveSqliteDatabasePath({ fileExists: fakeExists });
    assert.equal(path, "/riven/data/cineflow.db");
}

// 4. Fallback from cineflow.db to existing riven.db in the same directory
{
    const logs: string[] = [];
    const mockFiles = new Set(["/riven/data/riven.db"]);
    const fakeExists = (p: string) => mockFiles.has(p);
    const fakeLog = (msg: string) => logs.push(msg);

    const path = resolveSqliteDatabasePath({
        rawUrl: "/riven/data/cineflow.db",
        fileExists: fakeExists,
        log: fakeLog
    });

    assert.equal(path, "/riven/data/riven.db", "Must fall back to existing riven.db");
    assert.equal(logs.length, 1);
    assert.ok(logs[0].includes("Found existing database at"), "Must log fallback notice");
}

// 5. cineflow.db used directly if it already exists
{
    const logs: string[] = [];
    const mockFiles = new Set(["/riven/data/cineflow.db", "/riven/data/riven.db"]);
    const fakeExists = (p: string) => mockFiles.has(p);
    const fakeLog = (msg: string) => logs.push(msg);

    const path = resolveSqliteDatabasePath({
        rawUrl: "/riven/data/cineflow.db",
        fileExists: fakeExists,
        log: fakeLog
    });

    assert.equal(path, "/riven/data/cineflow.db", "Must prioritize cineflow.db when it exists");
    assert.equal(logs.length, 0, "Should not log fallback when target exists");
}

// 6. Local dev fallback from cineflow-local.db to riven-local.db
{
    const logs: string[] = [];
    const cwd = "/app/frontend";
    const mockFiles = new Set([resolve(cwd, "riven-local.db")]);
    const fakeExists = (p: string) => mockFiles.has(resolve(p));
    const fakeLog = (msg: string) => logs.push(msg);

    const path = resolveSqliteDatabasePath({
        rawUrl: "./cineflow-local.db",
        cwd,
        fileExists: fakeExists,
        log: fakeLog
    });

    assert.equal(path, resolve(cwd, "riven-local.db"), "Must fall back to riven-local.db");
    assert.equal(logs.length, 1);
}

// 7. Local dev fallback from cineflow-local.db to local.db
{
    const logs: string[] = [];
    const cwd = "/app/frontend";
    const mockFiles = new Set([resolve(cwd, "local.db")]);
    const fakeExists = (p: string) => mockFiles.has(resolve(p));
    const fakeLog = (msg: string) => logs.push(msg);

    const path = resolveSqliteDatabasePath({
        rawUrl: "./cineflow-local.db",
        cwd,
        fileExists: fakeExists,
        log: fakeLog
    });

    assert.equal(path, resolve(cwd, "local.db"), "Must fall back to local.db");
    assert.equal(logs.length, 1);
}

// 8. Custom file URI parsing
{
    const path = getSqlitePath("file:///data/custom.db");
    assert.ok(path.endsWith("custom.db"), "Must parse file: URI");
}

// 9. ensureSqliteDirectory handling
{
    assert.equal(ensureSqliteDirectory(undefined), undefined);
    assert.equal(ensureSqliteDirectory(":memory:"), ":memory:");
}

console.log("All SQLite database path resolution & fallback tests passed!");
