let dynamicPublicEnv: Record<string, string | undefined> = {};

try {
    // Dynamic import resolves in SvelteKit runtime while gracefully falling back in standalone Node/tsx test runners
    const mod = await import("$env/dynamic/public").catch(() => null);
    if (mod && "env" in mod) {
        dynamicPublicEnv = (mod.env || {}) as Record<string, string | undefined>;
    } else if (typeof process !== "undefined" && process.env) {
        dynamicPublicEnv = process.env;
    }
} catch {
    if (typeof process !== "undefined" && process.env) {
        dynamicPublicEnv = process.env;
    }
}

export const env = dynamicPublicEnv;
export default env;
