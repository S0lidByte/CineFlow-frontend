import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const ALLOWED_TYPES = new Set(["movie", "tv"]);

export const GET: RequestHandler = async ({ params, url }) => {
    const typeParam = url.searchParams.get("type")?.toLowerCase() ?? "";
    const mediaType = ALLOWED_TYPES.has(typeParam) ? typeParam : "movie";

    redirect(307, `/details/media/${params.id}/${mediaType}?play=true`);
};
