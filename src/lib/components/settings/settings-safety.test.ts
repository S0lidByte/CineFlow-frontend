/** Focused safety checks for generated settings forms. */
import {
    getBareTmpfsCacheRoots,
    getStreamReadAhead,
    labelNullablePathOptions
} from "./settings-safety";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

const readAhead = getStreamReadAhead({
    stream: { chunk_size_mb: 8, prefetch_chunks: 64 }
});
assert(readAhead?.totalMb === 512, "8 × 64 should report 512 MB read-ahead");
assert(readAhead?.isAggressive === true, "512 MB read-ahead should be aggressive");
assert(
    getStreamReadAhead({ stream: { chunk_size_mb: 8, prefetch_chunks: 12 } })?.totalMb === 96,
    "8 × 12 should report 96 MB"
);
assert(
    getStreamReadAhead({ stream: { chunk_size_mb: 8 } }) === null,
    "missing prefetch count should not invent a budget"
);

const roots = getBareTmpfsCacheRoots({
    filesystem: { cache_dir: "/mnt/cache", cache_hot_dir: "/dev/shm/" }
});
assert(roots.length === 1 && roots[0] === "/dev/shm", "bare hot tmpfs root should be detected");
assert(
    getBareTmpfsCacheRoots({
        filesystem: { cache_hot_dir: "/dev/shm/riven-cache" }
    }).length === 0,
    "dedicated cache directory should not warn"
);

const schema: Record<string, unknown> = {
    anyOf: [{ type: "string", format: "path" }, { type: "null" }]
};
labelNullablePathOptions(schema);
const options = schema.anyOf as Array<Record<string, unknown>>;
assert(options[0].title === "Use a path", "path option should have a clear label");
assert(options[1].title === "Disabled", "null option should have a clear label");

console.log("settings-safety.test.ts: ok");
