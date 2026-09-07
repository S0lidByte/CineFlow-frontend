import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("anilist");

export type AnilistTrendingResponse = {
    data: {
        Page: {
            media: AnilistTrendingMediaItem[];
        };
    };
};

export type AnilistTrendingMediaItem = {
    id: number;
    title: {
        romaji: string;
        english: string;
        native: string;
    };
    coverImage: {
        large: string;
    };
    seasonYear: number;
    format: string;
};

export const ANILIST_BASE_URL = "https://graphql.anilist.co";

const getTrendingQuery = (page: number, perPage: number = 20) => `
query {
  Page(page: ${page}, perPage: ${perPage}) {
    media(type: ANIME, sort: TRENDING_DESC) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        medium
      }
      seasonYear
      format
    }
  }
}
`;

const mediaRatingsQuery = `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    averageScore
    meanScore
  }
}
`;

export type AnilistMediaRatingsResponse = {
    data: {
        Media: {
            id: number;
            averageScore: number | null;
            meanScore: number | null;
        };
    };
};

export type AnilistFetchResult =
    | { success: true; data: AnilistTrendingResponse }
    | { success: false; status?: number; error: string; isOutage: boolean };

type FetchFunction = (url: string, init?: RequestInit) => Promise<Response>;

export async function getTrendingWithStatus(
    fetch: FetchFunction,
    page: number = 1
): Promise<AnilistFetchResult> {
    try {
        const response = await fetch(ANILIST_BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({
                query: getTrendingQuery(page)
            })
        });

        if (!response.ok) {
            let errorMsg = `HTTP ${response.status} ${response.statusText}`;
            let isOutage =
                response.status === 403 ||
                response.status === 502 ||
                response.status === 503 ||
                response.status === 504;

            try {
                const errorData = await response.json();
                if (errorData?.errors && Array.isArray(errorData.errors)) {
                    errorMsg = errorData.errors
                        .map((e: { message?: string }) => e.message || "")
                        .filter(Boolean)
                        .join("; ");
                    if (
                        errorData.errors.some(
                            (e: { status?: number; message?: string }) =>
                                e.status === 403 ||
                                (e.message &&
                                    (e.message.toLowerCase().includes("temporarily disabled") ||
                                        e.message.toLowerCase().includes("stability issues")))
                        )
                    ) {
                        isOutage = true;
                    }
                }
            } catch {
                // Response body is not JSON
            }

            logger.warn(`AniList request returned status ${response.status}: ${errorMsg}`);
            return { success: false, status: response.status, error: errorMsg, isOutage };
        }

        const data = await response.json();

        if (data.errors) {
            const errorMsg = Array.isArray(data.errors)
                ? data.errors
                      .map((e: { message?: string }) => e.message || "")
                      .filter(Boolean)
                      .join("; ")
                : JSON.stringify(data.errors);

            const isOutage =
                Array.isArray(data.errors) &&
                data.errors.some(
                    (e: { status?: number; message?: string }) =>
                        e.status === 403 ||
                        (e.message &&
                            (e.message.toLowerCase().includes("temporarily disabled") ||
                                e.message.toLowerCase().includes("stability issues")))
                );

            logger.warn(`AniList GraphQL errors: ${errorMsg}`);
            return { success: false, error: errorMsg, isOutage };
        }

        return { success: true, data: data as AnilistTrendingResponse };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error("Fetch error:", error);
        return { success: false, error: errorMsg, isOutage: false };
    }
}

export async function getTrending(fetch: FetchFunction, page: number = 1) {
    const result = await getTrendingWithStatus(fetch, page);
    return result.success ? result.data : null;
}

export async function getMediaDetails(anilistId: number, fetch: FetchFunction) {
    try {
        const response = await fetch(ANILIST_BASE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify({
                query: mediaRatingsQuery,
                variables: { id: anilistId }
            })
        });

        const data = await response.json();

        if (data.errors) {
            logger.error("GraphQL errors:", data.errors);
            return null;
        }

        return data as AnilistMediaRatingsResponse;
    } catch (error) {
        logger.error("Fetch error:", error);
        return null;
    }
}
