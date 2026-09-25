import { createAuthClient } from "better-auth/svelte";
import { usernameClient, adminClient, lastLoginMethodClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

/**
 * Better Auth client configured with username, admin, passkey, and last login plugins.
 */
export const authClient = createAuthClient({
    plugins: [usernameClient(), adminClient(), passkeyClient(), lastLoginMethodClient()]
});

/** Sign-in helper exported from Better Auth client. */
export const signIn = authClient.signIn;

/** Sign-up helper exported from Better Auth client. */
export const signUp = authClient.signUp;

/** Reactive session hook exported from Better Auth client. */
export const useSession = authClient.useSession;
