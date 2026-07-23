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
     * - Progressive disclosure for nested object groups (collapsible legends).
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
    import Check from "@lucide/svelte/icons/check";
    import { getTabById } from "./sections";
    import { tick } from "svelte";

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
    let formHost: HTMLDivElement | null = $state(null);

    // svelte-ignore state_referenced_locally
    const { form } = setupSvelteKitForm(meta, {
        ...defaults,
        schema: (pageData.form?.schema ?? { type: "object" }) as Record<string, unknown>,
        data: pageData.form ? pageData : { form: { schema: { type: "object" } } },
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

    // Reset saveStatus to idle on any new edit; also auto-dismiss success after 4 s
    // so the banner doesn't linger after the user starts working again.
    let successTimer: ReturnType<typeof setTimeout> | null = null;
    $effect(() => {
        if (isDirty) {
            if (successTimer) { clearTimeout(successTimer); successTimer = null; }
            saveStatus = "idle";
        }
    });
    $effect(() => {
        if (saveStatus === "success") {
            if (successTimer) clearTimeout(successTimer);
            successTimer = setTimeout(() => { saveStatus = "idle"; }, 4000);
        }
        return () => { if (successTimer) { clearTimeout(successTimer); successTimer = null; } };
    });

    // Keep the page-shell's formStore in sync with the live form state.
    $effect(() => {
        formStore.set(form);
    });

    /**
     * Make nested object fieldsets collapsible.
     * Categories that contain other fieldsets start collapsed (first sibling stays open)
     * so Ranking/Content-style trees are scannable instead of an endless card wall.
     */
    function enhanceCollapsibleSections(root: HTMLElement): () => void {
        const cleanups: Array<() => void> = [];
        const fieldsets = root.querySelectorAll<HTMLFieldSetElement>(
            'fieldset[data-slot="field-set"]'
        );

        fieldsets.forEach((fs) => {
            const legend = fs.querySelector<HTMLElement>(
                ':scope > legend[data-slot="field-legend"]'
            );
            const content = fs.querySelector<HTMLElement>(':scope > [data-slot="field-group"]');
            if (!legend || !content) return;
            if (legend.dataset.settingsCollapsible === "1") return;

            const childFieldsets = content.querySelectorAll(
                ':scope fieldset[data-slot="field-set"]'
            );
            // Only wrap groups that contain nested objects (real sections), not leaf attribute bags.
            if (childFieldsets.length === 0 && activeTabId !== "ranking") return;
            if (childFieldsets.length === 0) {
                // On ranking, also collapse leaf attribute objects (fetch/rank triplets)
                // when they sit under a category fieldset.
                const parentFs = fs.parentElement?.closest('fieldset[data-slot="field-set"]');
                if (!parentFs) return;
            }

            legend.dataset.settingsCollapsible = "1";
            legend.setAttribute("role", "button");
            legend.tabIndex = 0;
            legend.classList.add("settings-collapsible-legend");

            const parentFs = fs.parentElement?.closest('fieldset[data-slot="field-set"]');
            const siblings = parentFs
                ? Array.from(
                      parentFs.querySelectorAll<HTMLFieldSetElement>(
                          ':scope > [data-slot="field-group"] > fieldset[data-slot="field-set"]'
                      )
                  )
                : [];
            const isFirstSibling = siblings.length > 0 ? siblings[0] === fs : !parentFs;
            // Top-level section open; nested categories: first open, rest collapsed.
            const openByDefault = !parentFs || isFirstSibling;

            const setOpen = (open: boolean) => {
                fs.toggleAttribute("data-collapsed", !open);
                legend.setAttribute("aria-expanded", open ? "true" : "false");
                content.hidden = !open;
            };

            setOpen(openByDefault);

            const onClick = () => setOpen(fs.hasAttribute("data-collapsed"));
            const onKey = (e: KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick();
                }
            };
            legend.addEventListener("click", onClick);
            legend.addEventListener("keydown", onKey);
            cleanups.push(() => {
                legend.removeEventListener("click", onClick);
                legend.removeEventListener("keydown", onKey);
            });
        });

        return () => cleanups.forEach((fn) => fn());
    }

    $effect(() => {
        const host = formHost;
        if (!host) return;

        let dispose = () => {};
        let timer: ReturnType<typeof setTimeout> | null = null;

        const run = async () => {
            await tick();
            dispose();
            dispose = enhanceCollapsibleSections(host);
        };

        const schedule = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                void run();
            }, 80);
        };

        void run();
        const observer = new MutationObserver(schedule);
        observer.observe(host, { childList: true, subtree: true });

        return () => {
            if (timer) clearTimeout(timer);
            dispose();
            observer.disconnect();
        };
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
{:else if saveStatus === "success"}
    <div
        class="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm"
        role="status"
        aria-live="polite">
        <Check class="size-4 shrink-0 text-emerald-500" />
        <span class="text-emerald-600 dark:text-emerald-400 font-medium">Settings saved successfully.</span>
    </div>
{/if}

<div class="settings-form-host" bind:this={formHost}>
    <BasicForm {form} method="POST" class="settings-form" />
</div>

<style>
    /**
     * Form field layout and theming.
     * Targets SJSF data-slot attributes so styles stay scoped to settings forms.
     */

    :global(.settings-form) {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: 1fr;
    }

    :global(.settings-form [data-slot="field-group"]),
    :global(.settings-form [data-layout="object-properties"]) {
        display: grid !important;
        gap: 0.65rem;
        grid-template-columns: 1fr;
    }

    @media (min-width: 768px) {
        :global(.settings-form) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.75rem;
        }

        :global(.settings-form [data-slot="field-group"]),
        :global(.settings-form [data-layout="object-properties"]) {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.65rem;
        }

        /* Nested object / array fields span full width */
        :global(.settings-form [data-slot="field"]:has([data-slot="field"])),
        :global(.settings-form [data-slot="field-group"] > fieldset[data-slot="field-set"]),
        :global(.settings-form [data-layout="array-field"]),
        :global(.settings-form [data-layout="array-item"]),
        :global(
            .settings-form [data-layout="object-property"]:has(fieldset[data-slot="field-set"])
        ),
        :global(
            .settings-form [data-layout="object-property"]:has([data-layout="array-field"])
        ),
        :global(
            .settings-form [data-slot="field-group"] > [data-slot="field"]:has([data-slot="field"])
        ) {
            grid-column: 1 / -1;
        }

        /* Root schema wrappers span full width */
        :global(.settings-form > form > [data-slot="field"]),
        :global(.settings-form > form > fieldset[data-slot="field-set"]) {
            grid-column: 1 / -1;
        }
    }

    /* Section headers: left-aligned full-width legends with divider */
    :global(.settings-form fieldset[data-slot="field-set"]) {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.5rem;
        min-inline-size: 0;
        border: none;
        padding: 0;
        margin: 0;
    }

    :global(.settings-form legend[data-slot="field-legend"]) {
        float: none;
        display: block;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        text-align: left;
        font-size: 0.85rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        margin: 0 0 0.15rem;
        padding: 0 0 0.45rem 0.55rem;
        border-bottom: 1px solid color-mix(in oklab, var(--color-primary) 22%, var(--color-border));
        border-left: 3px solid color-mix(in oklab, var(--color-primary) 55%, transparent);
        color: color-mix(in oklab, var(--color-foreground) 92%, transparent);
    }

    :global(.settings-form legend.settings-collapsible-legend) {
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        border-radius: 0.375rem;
        padding: 0.25rem 0.35rem 0.5rem;
        margin-left: -0.35rem;
        margin-right: -0.35rem;
        width: calc(100% + 0.7rem);
        max-width: none;
    }

    :global(.settings-form legend.settings-collapsible-legend:hover) {
        background: color-mix(in oklab, var(--color-primary) 12%, var(--color-muted));
    }

    :global(.settings-form legend.settings-collapsible-legend::before) {
        content: "▾";
        display: inline-block;
        font-size: 0.7rem;
        opacity: 0.75;
        transition: transform 0.15s ease;
        flex-shrink: 0;
    }

    :global(.settings-form fieldset[data-collapsed] > legend.settings-collapsible-legend::before) {
        transform: rotate(-90deg);
    }

    :global(.settings-form fieldset[data-collapsed]) {
        padding-bottom: 0.15rem;
    }

    /* Field cards with subtle primary accent */
    :global(.settings-form [data-slot="field"]) {
        border: 1px solid color-mix(in oklab, var(--color-border) 50%, transparent);
        border-radius: 0.5rem;
        background: linear-gradient(
            135deg,
            color-mix(in oklab, var(--color-card) 70%, transparent),
            color-mix(in oklab, var(--color-primary) 4%, var(--color-card))
        );
        padding: 0.45rem 0.6rem;
        min-width: 0;
        gap: 0.35rem;
    }

    :global(.settings-form fieldset[data-slot="field-set"] > [data-slot="field-group"]) {
        padding-top: 0.35rem;
        padding-left: 0.25rem;
        border-left: 1px solid color-mix(in oklab, var(--color-primary) 18%, transparent);
        margin-left: 0.15rem;
    }

    :global(.settings-form [data-slot="field"] [data-slot="field"]) {
        background: color-mix(in oklab, var(--color-background) 40%, transparent);
        border-color: color-mix(in oklab, var(--color-border) 40%, transparent);
    }

    /* Nested object groups */

    :global(.settings-form [data-slot="field-label"]) {
        font-weight: 600;
        font-size: 0.875rem;
        color: color-mix(in oklab, var(--color-foreground) 90%, transparent);
    }

    :global(.settings-form [data-slot="field-description"]) {
        color: var(--color-muted-foreground);
        font-size: 0.74rem;
        line-height: 1.35;
        margin-top: 0.1rem;
    }

    :global(.settings-form [data-slot="input"]),
    :global(.settings-form [data-slot="textarea"]),
    :global(.settings-form [data-slot="select-trigger"]) {
        min-height: 2rem;
    }

    :global(.settings-form :focus-visible) {
        outline: 2px solid var(--color-ring);
        outline-offset: 2px;
    }

    :global(.settings-form [data-slot="field-error"]) {
        font-size: 0.78rem;
        margin-top: 0.25rem;
    }

    :global(.settings-form [data-settings-focus="true"]) {
        border-color: color-mix(in oklab, var(--color-primary) 55%, transparent);
        box-shadow:
            0 0 0 2px color-mix(in oklab, var(--color-primary) 35%, transparent),
            0 0 0 6px color-mix(in oklab, var(--color-primary) 12%, transparent);
        transition:
            box-shadow 0.25s ease,
            border-color 0.25s ease;
    }

    /* Completely suppress residual SJSF default submit button containers */
    :global(.settings-form [data-slot="submit"]),
    :global(.settings-form button[type="submit"]),
    :global(.settings-form > form > button[type="submit"]) {
        display: none !important;
        margin: 0 !important;
        padding: 0 !important;
        height: 0 !important;
        min-height: 0 !important;
        overflow: hidden !important;
    }

    /* Switch fields: clean horizontal row with text left and toggle right */
    :global(.settings-form [data-slot="field"]:has(button[role="switch"])) {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
    }

    :global(.settings-form [data-slot="field"]:has(button[role="switch"]) > [data-slot="field-label-group"]) {
        flex: 1;
        min-width: 0;
    }

    /* Array "Add item" and action controls — compact inline buttons */
    :global(.settings-form [data-slot="button-group"]),
    :global(.settings-form [data-layout="array-field"] > [data-slot="button-group"]),
    :global(.settings-form button[type="button"]:is([data-slot="button"])) {
        width: fit-content;
        max-width: 100%;
        justify-self: start;
    }

    :global(.settings-form [data-layout="array-field"] [data-slot="button-group"]) {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: flex-start;
    }

    :global(.settings-form [data-layout="array-field"] [data-slot="button-group"] > *) {
        width: auto;
        flex: 0 0 auto;
    }

    /**
     * Compact Ranking attribute objects: force Fetch / Custom Rank / Rank onto one row.
     */
    @media (min-width: 900px) {
        :global(
            .settings-form
                [data-layout="object-field"]
                > [data-layout="object-properties"]
                > [data-layout="object-property"]:has(
                    [data-layout="object-field"]
                        > [data-layout="object-properties"]
                        > [data-layout="object-property"]:nth-child(3)
                )
        ) {
            grid-column: 1 / -1;
        }

        :global(
            .settings-form
                [data-layout="object-field"]
                > [data-layout="object-properties"]:has(
                    > [data-layout="object-property"]:nth-child(3)
                ):not(:has(> [data-layout="object-property"]:nth-child(4)))
        ) {
            grid-template-columns: minmax(0, 1.15fr) minmax(0, 1.15fr) minmax(4.5rem, 0.7fr) !important;
            gap: 0.5rem;
        }
    }
</style>
