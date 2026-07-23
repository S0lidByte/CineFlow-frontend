import createClient from "openapi-fetch";
import { env as privateEnv } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";
import publicProviders from "$lib/providers";
import { customFetch } from "$lib/custom-fetch";

import type { paths as TMDBPaths } from "$lib/providers/tmdb";

export * from "$lib/providers";

const tmdbReadAccessToken =
    privateEnv.TMDB_READ_ACCESS_TOKEN ||
    privateEnv.PUBLIC_TMDB_READ_ACCESS_TOKEN ||
    publicEnv.PUBLIC_TMDB_READ_ACCESS_TOKEN ||
    "";
const backendUrl = privateEnv.BACKEND_URL?.replace(/\/+$/, "") || "";
const backendApiKey = privateEnv.BACKEND_API_KEY || "";
const useBackendTMDBProxy = !tmdbReadAccessToken && Boolean(backendUrl && backendApiKey);

export const hasTMDBReadAccessToken = Boolean(tmdbReadAccessToken);
export const tmdbProviderBaseUrl = useBackendTMDBProxy
    ? `${backendUrl}/api/v1/tmdb`
    : "https://api.themoviedb.org";

const tmdbClient = createClient<TMDBPaths>({
    baseUrl: tmdbProviderBaseUrl,
    headers: {
        ...(tmdbReadAccessToken ? { Authorization: `Bearer ${tmdbReadAccessToken}` } : {}),
        ...(useBackendTMDBProxy ? { "x-api-key": backendApiKey } : {}),
        "Content-Type": "application/json;charset=utf-8"
    },
    fetch: customFetch
});

export default {
    ...publicProviders,
    tmdb: tmdbClient
};
