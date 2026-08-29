import { redirect } from "@sveltejs/kit";
import { message, superValidate, fail, setError } from "sveltekit-superforms";
import { loginSchema, registerSchema } from "$lib/schemas/auth";
import type { Actions, PageServerLoad } from "./$types";
import { zod4 } from "sveltekit-superforms/adapters";
import { auth } from "$lib/server/auth";
import { APIError } from "better-auth/api";
import { getUsersCount, isPublicRegistrationAllowed } from "$lib/server/functions";
import { getAuthProviders } from "$lib/server/auth";
import { createScopedLogger } from "$lib/logger";

const logger = createScopedLogger("auth");

async function getAuthInfo() {
    const authProviders = getAuthProviders();
    const allowPublicReg = await isPublicRegistrationAllowed();
    const isSignupEnabled = !!(authProviders.credential?.enabled && allowPublicReg);
    const isCredentialEnabled = !!authProviders.credential?.enabled;
    return { authProviders, isSignupEnabled, isCredentialEnabled };
}

export const load: PageServerLoad = async (event) => {
    if (event.locals.user) {
        return redirect(302, "/auth");
    }

    const { authProviders, isSignupEnabled } = await getAuthInfo();
    const isFirstUser = await noUserExists();
    const canRegister = isSignupEnabled || isFirstUser;

    const loginForm = await superValidate(zod4(loginSchema), {
        id: "loginForm"
    });
    const registerForm = canRegister
        ? await superValidate(zod4(registerSchema), { id: "registerForm" })
        : null;
    return { loginForm, registerForm, authProviders, isFirstUser };
};

async function noUserExists() {
    const count = await getUsersCount();
    return count === 0;
}

export const actions: Actions = {
    login: async (event) => {
        const { isCredentialEnabled } = await getAuthInfo();
        if (!isCredentialEnabled) {
            return fail(403, { message: "Email/password login is disabled" });
        }

        const loginForm = await superValidate(event.request, zod4(loginSchema));
        if (!loginForm.valid) return fail(400, { loginForm });

        try {
            await auth.api.signInUsername({
                body: {
                    username: loginForm.data.username,
                    password: loginForm.data.password,
                    callbackURL: "/"
                },
                headers: event.request.headers
            });
        } catch (error) {
            if (error instanceof APIError) {
                return message(loginForm, error.message, {
                    status: 400
                });
            }
            logger.error("Error during login:", error);
            return message(loginForm, "An unexpected error occurred", {
                status: 500
            });
        }

        return redirect(303, "/");
    },
    register: async (event) => {
        const { isSignupEnabled } = await getAuthInfo();
        const isFirstUser = await noUserExists();

        // Allow registration if signup is enabled OR if this is the first user (admin setup)
        if (!isSignupEnabled && !isFirstUser) {
            return fail(403, {
                message: "Public registration is currently disabled by the administrator"
            });
        }

        const registerForm = await superValidate(event.request, zod4(registerSchema));
        if (!registerForm.valid) return fail(400, { registerForm });

        if (registerForm.data.password !== registerForm.data.confirmPassword) {
            return setError(registerForm, "confirmPassword", "Passwords do not match.");
        }

        try {
            const isFirstUser = await noUserExists();
            if (isFirstUser) {
                logger.info("No users exist, assigning admin role to the first registered user.");

                const data = await auth.api.createUser({
                    body: {
                        name: registerForm.data.username,
                        email: registerForm.data.email,
                        password: registerForm.data.password,
                        role: "admin",
                        data: {
                            username: registerForm.data.username,
                            image: registerForm.data.image || undefined
                        }
                    }
                });

                logger.info("First user (admin) created:", data);

                await auth.api.signInUsername({
                    body: {
                        username: registerForm.data.username,
                        password: registerForm.data.password,
                        callbackURL: "/"
                    },
                    headers: event.request.headers
                });
            } else {
                await auth.api.signUpEmail({
                    body: {
                        name: registerForm.data.username,
                        username: registerForm.data.username,
                        email: registerForm.data.email,
                        password: registerForm.data.password,
                        image: registerForm.data.image || undefined
                    },
                    headers: event.request.headers
                });

                await auth.api.signInUsername({
                    body: {
                        username: registerForm.data.username,
                        password: registerForm.data.password,
                        callbackURL: "/"
                    },
                    headers: event.request.headers
                });
            }
        } catch (error) {
            if (error instanceof APIError) {
                return message(registerForm, error.message, {
                    status: 400
                });
            }
            logger.error("Error during sign up:", error);
            return message(registerForm, "An unexpected error occurred", {
                status: 500
            });
        }

        return redirect(303, "/");
    }
};
