import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { db } from "$lib/server/db";
import { user } from "$lib/server/schema";
import { auth } from "$lib/server/auth";
import { isPublicRegistrationAllowed } from "$lib/server/functions";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("admin-users-api");

/**
 * GET /api/admin/users
 * Returns list of all users, admin count, and registration status.
 */
export const GET: RequestHandler = async ({ locals }) => {
    if (locals.user?.role !== "admin") {
        return json({ error: "Forbidden: Administrator privileges required." }, { status: 403 });
    }

    try {
        const usersList = await db
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                displayUsername: user.displayUsername,
                role: user.role,
                banned: user.banned,
                banReason: user.banReason,
                banExpires: user.banExpires,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                lastLoginMethod: user.lastLoginMethod
            })
            .from(user)
            .orderBy(user.createdAt);

        const totalUsers = usersList.length;
        const adminCount = usersList.filter((u) => u.role === "admin").length;
        const publicRegistrationAllowed = await isPublicRegistrationAllowed();

        return json({
            users: usersList,
            totalUsers,
            adminCount,
            publicRegistrationAllowed
        });
    } catch (e) {
        logger.error("Failed to list users", { error: e });
        return json({ error: "Failed to fetch users" }, { status: 500 });
    }
};

/**
 * POST /api/admin/users
 * Admin creates a new user with specified role and credentials.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
    if (locals.user?.role !== "admin") {
        return json({ error: "Forbidden: Administrator privileges required." }, { status: 403 });
    }

    try {
        const body = (await request.json()) as {
            username?: string;
            email?: string;
            password?: string;
            role?: string;
            name?: string;
        };

        const rawUsername = body.username?.trim();
        const rawEmail = body.email?.trim().toLowerCase();
        const rawPassword = body.password;
        const role = (body.role || "user") as "user" | "admin" | "manager";
        const name = body.name?.trim() || rawUsername;

        if (!rawUsername || rawUsername.length < 3) {
            return json({ error: "Username must be at least 3 characters long." }, { status: 400 });
        }
        if (!rawEmail || !rawEmail.includes("@")) {
            return json({ error: "A valid email address is required." }, { status: 400 });
        }
        if (!rawPassword || rawPassword.length < 8) {
            return json({ error: "Password must be at least 8 characters long." }, { status: 400 });
        }
        if (!["admin", "manager", "user"].includes(role)) {
            return json({ error: "Invalid role specified." }, { status: 400 });
        }

        const newUser = await auth.api.createUser({
            body: {
                name: name || rawUsername,
                email: rawEmail,
                password: rawPassword,
                role: role as "user" | "admin" | "manager",
                data: {
                    username: rawUsername,
                    displayUsername: rawUsername
                }
            },
            headers: request.headers
        });

        logger.info("Admin created user successfully", {
            adminId: locals.user.id,
            newUserId: newUser.user?.id,
            username: rawUsername,
            role
        });

        return json({ success: true, user: newUser.user }, { status: 201 });
    } catch (e: unknown) {
        logger.error("Failed to create user", { error: e });
        const message = e instanceof Error ? e.message : "Failed to create user";
        return json({ error: message }, { status: 400 });
    }
};
