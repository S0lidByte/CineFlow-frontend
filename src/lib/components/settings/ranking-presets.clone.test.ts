/**
 * Regression: Pack switch + presets used structuredClone on Svelte $state proxies,
 * which throws DataCloneError and makes only the Anime Dub Friendly confirm path
 * appear to work (dialog opens before clone).
 *
 * Run: pnpm exec tsx src/lib/components/settings/ranking-presets.clone.test.ts
 */
import { applyRankingPreset, cloneRankingSettings, RANKING_PRESETS } from "./ranking-presets.ts";

function assert(cond: unknown, msg: string): asserts cond {
    if (!cond) throw new Error(msg);
}

const base = {
    custom_ranks: {
        quality: {
            hevc: { fetch: true, use_custom_rank: false, rank: 0 },
            webdl: { fetch: false, use_custom_rank: false, rank: 0 }
        },
        trash: {
            cam: { fetch: false, use_custom_rank: false, rank: 0 }
        }
    },
    options: { title_similarity: 0.85, remove_all_trash: true },
    resolutions: { r1080p: true },
    languages: { required: [], allowed: [], exclude: [], preferred: [] },
    require: [] as string[],
    exclude: [] as string[],
    preferred: [] as string[]
};

// Simulate a Svelte 5 $state proxy (structuredClone cannot clone Proxies).
const proxied = new Proxy(base, {
    get(target, prop, receiver) {
        return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
        return Reflect.set(target, prop, value, receiver);
    }
});

let threw = false;
try {
    structuredClone(proxied);
} catch {
    threw = true;
}
assert(threw, "expected structuredClone(proxy) to throw DataCloneError");

const cloned = cloneRankingSettings(proxied);
assert(cloned !== base, "clone should be a new object");
assert(cloned.custom_ranks?.quality?.hevc?.fetch === true, "clone preserves fetch");

const balanced = RANKING_PRESETS.find((p) => p.id === "balanced");
assert(balanced, "balanced preset exists");
const applied = applyRankingPreset(proxied, balanced);
assert(applied.options?.title_similarity === 0.85, "balanced options applied");
assert(
    applied.exclude?.some((p) => p.includes("matte")),
    "balanced exclude applied"
);

console.log("ranking-presets.clone.test.ts: ok");
