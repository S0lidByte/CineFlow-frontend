export interface StreamReadAhead {
    chunkSizeMb: number;
    prefetchChunks: number;
    totalMb: number;
    isAggressive: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Calculate the maximum sequential read-ahead work configured per stream. */
export function getStreamReadAhead(root: unknown): StreamReadAhead | null {
    if (!isRecord(root) || !isRecord(root.stream)) return null;

    const chunkSizeMb = Number(root.stream.chunk_size_mb);
    const prefetchChunks = Number(root.stream.prefetch_chunks);
    if (
        !Number.isFinite(chunkSizeMb) ||
        !Number.isFinite(prefetchChunks) ||
        chunkSizeMb < 1 ||
        prefetchChunks < 0
    ) {
        return null;
    }

    const totalMb = chunkSizeMb * prefetchChunks;
    return {
        chunkSizeMb,
        prefetchChunks,
        totalMb,
        isAggressive: totalMb > 256
    };
}

/** Return cache settings that claim a complete shared-memory mount root. */
export function getBareTmpfsCacheRoots(root: unknown): string[] {
    if (!isRecord(root) || !isRecord(root.filesystem)) return [];

    const bareRoots = new Set<string>();
    for (const key of ["cache_dir", "cache_hot_dir"]) {
        const value = root.filesystem[key];
        if (typeof value !== "string") continue;
        const normalized = value.trim().replaceAll("\\", "/").replace(/\/+$/, "");
        if (normalized === "/dev/shm" || normalized === "/run/shm") {
            bareRoots.add(normalized);
        }
    }
    return [...bareRoots];
}

/** Give nullable path alternatives meaningful labels instead of "option 1". */
export function labelNullablePathOptions(node: unknown): void {
    if (!isRecord(node)) return;

    if (Array.isArray(node.anyOf)) {
        const options = node.anyOf.filter(isRecord);
        const pathOption = options.find(
            (option) => option.type === "string" && option.format === "path"
        );
        const nullOption = options.find((option) => option.type === "null");
        if (pathOption && nullOption) {
            pathOption.title = "Use a path";
            nullOption.title = "Disabled";
        }
    }

    for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
            value.forEach(labelNullablePathOptions);
        } else if (isRecord(value)) {
            labelNullablePathOptions(value);
        }
    }
}
