<script lang="ts">
    /**
     * Settings form content block.
     *
     * Renders the SJSF-managed form for the active settings section.
     * This component is intentionally stripped of any Card wrapper so the parent
     * panel in `+page.svelte` acts as the sole visual container, avoiding a nested-
     * card appearance.
     *
     * Responsibilities:
     * - Set up the SvelteKit form with SJSF and the shared shadcn theme.
     * - Write the live `FormState` into `formStore` so the page shell can query
     *   `isChanged` and call `reset()` without prop-drilling.
     * - Show an inline error alert when a save attempt fails.
     * - Fire success/error toasts after save.
     */
    import type { ActionData, PageData } from "../../../routes/(protected)/settings/$types";
    import type { FormState } from "@sjsf/form";
    import { BasicForm } from "@sjsf/form";
    import { createMeta, setupSvelteKitForm } from "@sjsf/sveltekit/client";
    import * as defaults from "./form-defaults";
    import { setShadcnContext } from "$lib/components/shadcn-context";
    import { toast } from "svelte-sonner";
    import { icons } from "@sjsf/lucide-icons";
    import { Alert, AlertDescription, AlertTitle } from "$lib/components/ui/alert/index.js";
    import AlertCircle from "@lucide/svelte/icons/alert-circle";
    import { getTabById } from "./sections";

    interface Props {
        /**
         * A writable store exposed by the page shell.
         * This component writes the live `FormState` into it so the shell can
         * check `isChanged` and call `reset()` without additional prop drilling.
         */
        formStore: { set: (f: FormState<unknown>) => void };
        /** The resolved page data from the server. Passed explicitly to survive transition routing. */
        pageData: PageData;
        /** The action data from a form submission. */
        actionData?: ActionData;
        /** The currently active tab ID. */
        activeTabId: string;
    }
    let { formStore, pageData, actionData, activeTabId }: Props = $props();

    setShadcnContext();

    // Use passed data over reactive $page store to prevent undefined crashes mid-navigation
    const meta = createMeta<ActionData, PageData>().form;

    /** Tracks the last save outcome to conditionally show the inline error alert. */
    let saveStatus = $state<"idle" | "success" | "error">("idle");

    // svelte-ignore state_referenced_locally
    const { form } = setupSvelteKitForm(meta, {
        ...defaults,
        schema: (pageData.form?.schema ?? { type: "object" }) as any,
        data: pageData.form ? pageData : undefined,
        action: actionData,
        icons,
        delayedMs: 500,
        timeoutMs: 30000,
        onSuccess: (result: { type: string }) => {
            if (result.type === "success") {
                const tab = getTabById(activeTabId);
                if (tab?.restartRequired) {
                    toast.success("Settings saved. Some changes may take effect after restart.");
                } else {
                    toast.success("Settings saved");
                }
                saveStatus = "success";
            } else {
                toast.error("Failed to save settings");
                saveStatus = "error";
            }
        },
        onFailure: () => {
            toast.error("Something went wrong while saving settings");
            saveStatus = "error";
        }
    });

    /** Whether the form has unsaved changes (mirrors `form.isChanged`). */
    const isDirty = $derived(form?.isChanged ?? false);

    // Reset saveStatus to idle whenever the user makes a new change so stale
    // "error" state doesn't linger after they start editing again.
    $effect(() => {
        if (isDirty) {
            saveStatus = "idle";
        }
    });

    // Keep the page-shell's formStore in sync with the live form state.
    $effect(() => {
        formStore.set(form);
    });
</script>

{#if saveStatus === "error"}
    <Alert variant="destructive" class="mb-4 py-2">
        <AlertCircle class="size-4" />
        <AlertTitle>Save failed</AlertTitle>
        <AlertDescription>
            Settings were not persisted. Review form errors and retry.
        </AlertDescription>
    </Alert>
{/if}

<BasicForm {form} method="POST" class="settings-form" />

<style>
    /**
     * Form field layout and theming.
     * All rules target the SJSF data-slot attributes so they stay encapsulated
     * to the settings form and don't bleed into other components.
     */

    :global(.settings-form) {
        display: grid;
        gap: 0.875rem;
    }

    :global(.settings-form [data-slot="field"]) {
        border: 1px solid color-mix(in oklab, var(--color-border) 80%, transparent);
        border-radius: 0.625rem;
        background: color-mix(in oklab, var(--color-card) 92%, transparent);
        padding: 0.75rem 0.875rem;
    }

    :global(.settings-form [data-slot="field-label"]) {
        font-weight: 600;
        color: color-mix(in oklab, var(--color-foreground) 90%, transparent);
    }

    :global(.settings-form [data-slot="field-description"]) {
        color: var(--color-muted-foreground);
        font-size: 0.78rem;
        line-height: 1.4;
        margin-top: 0.15rem;
    }

    :global(.settings-form [data-slot="input"]),
    :global(.settings-form [data-slot="textarea"]),
    :global(.settings-form [data-slot="select-trigger"]) {
        min-height: 2.2rem;
    }

    :global(.settings-form :focus-visible) {
        outline: 2px solid var(--color-ring);
        outline-offset: 2px;
    }

    :global(.settings-form [data-slot="field-error"]) {
        font-size: 0.78rem;
        margin-top: 0.25rem;
    }
</style>
