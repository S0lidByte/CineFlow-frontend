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
    import { BasicForm, getValueSnapshot } from "@sjsf/form";
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
    const { form, request } = setupSvelteKitForm(meta, {
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
            if (successTimer) {
                clearTimeout(successTimer);
                successTimer = null;
            }
            saveStatus = "idle";
        }
    });
    $effect(() => {
        if (saveStatus === "success") {
            if (successTimer) clearTimeout(successTimer);
            successTimer = setTimeout(() => {
                saveStatus = "idle";
            }, 4000);
        }
        return () => {
            if (successTimer) {
                clearTimeout(successTimer);
                successTimer = null;
            }
        };
    });

    // Keep the page-shell's formStore in sync with the live form state.
    $effect(() => {
        formStore.set(form);
    });

    /**
     * Make nested object fieldsets collapsible.
     * Policy: depth 0–1 open by default; depth ≥2 collapsed (first sibling at depth 2 stays open).
     * Ranking leaf attribute bags (fetch/rank) stay non-collapsible so Fetch|Rank stay visible.
     */
    function fieldsetDepth(fs: HTMLElement): number {
        let depth = 0;
        let parent = fs.parentElement?.closest('fieldset[data-slot="field-set"]') ?? null;
        while (parent) {
            depth += 1;
            parent = parent.parentElement?.closest('fieldset[data-slot="field-set"]') ?? null;
        }
        return depth;
    }

    /** Strip schema noise like "TorrentioConfig" / "FooDict" and split CamelCase titles. */
    function sanitizeLegendTitle(raw: string): string {
        return raw
            .replace(/\b(\w+)(?:Config|Dict|Model|Settings|Provider)\b/g, "$1")
            .replace(/\s+Provider$/i, "")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/\s{2,}/g, " ")
            .trim();
    }

    function legendTitleText(legend: HTMLElement): string {
        // Prefer explicit title node; fall back to concatenated text without chevron noise.
        const titleEl =
            legend.querySelector<HTMLElement>("[data-layout='object-field-title']") ??
            legend.querySelector<HTMLElement>(":scope > div, :scope > span");
        const raw = (titleEl?.textContent ?? legend.textContent ?? "").replace(/[▾▾]/g, "").trim();
        return sanitizeLegendTitle(raw);
    }

    /**
     * Polish legends: sanitize titles, hide root duplicate of page H1, force left-aligned rows.
     */
    function polishLegends(root: HTMLElement, tabId: string): void {
        const tab = getTabById(tabId);
        const tabLabel = (tab?.label ?? "").trim().toLowerCase();

        root.querySelectorAll<HTMLElement>('legend[data-slot="field-legend"]').forEach((legend) => {
            // Kill SJSF justify-between that shoves titles to the far right.
            legend.classList.remove("justify-between");
            legend.style.justifyContent = "flex-start";
            legend
                .querySelectorAll<HTMLElement>("[data-layout='object-field-title-row']")
                .forEach((row) => {
                    row.classList.remove("justify-between");
                    row.style.justifyContent = "flex-start";
                    row.style.gap = "0.5rem";
                    row.style.width = "auto";
                    row.style.flex = "1 1 auto";
                    row.style.minWidth = "0";
                });

            // Sanitize visible title text once.
            if (legend.dataset.settingsTitleSanitized !== "1") {
                const walk = (node: Node) => {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                        const next = sanitizeLegendTitle(node.textContent);
                        if (next !== node.textContent) node.textContent = next;
                    } else if (node.nodeType === Node.ELEMENT_NODE) {
                        node.childNodes.forEach(walk);
                    }
                };
                walk(legend);
                legend.dataset.settingsTitleSanitized = "1";
            }

            // Mark provider legends whose "Enabled" checkbox is on (for CSS badge).
            const fs = legend.closest<HTMLFieldSetElement>('fieldset[data-slot="field-set"]');
            if (fs) {
                const enabledOn = Array.from(
                    fs.querySelectorAll<HTMLElement>('[data-slot="field"]')
                ).some((field) => {
                    // Only fields owned by this fieldset (not nested provider cards)
                    if (field.closest('fieldset[data-slot="field-set"]') !== fs) return false;
                    const label = (
                        field.querySelector("[data-slot='field-label']")?.textContent ?? ""
                    )
                        .trim()
                        .toLowerCase();
                    if (label !== "enabled") return false;
                    return !!field.querySelector(
                        'button[data-slot="checkbox"][data-state="checked"], button[role="switch"][data-state="checked"], input[type="checkbox"]:checked'
                    );
                });
                if (enabledOn) legend.dataset.settingsEnabled = "1";
                else delete legend.dataset.settingsEnabled;
            }
        });

        // Hide the section legend that duplicates the page H1 (tab label).
        // SJSF often wraps tab content as form > fieldset(root, no legend) > … > fieldset(legend=Tab).
        root.querySelectorAll<HTMLFieldSetElement>('fieldset[data-slot="field-set"]').forEach(
            (fs) => {
                const depth = fieldsetDepth(fs);
                if (depth > 1) return;
                const legend = fs.querySelector<HTMLElement>(
                    ':scope > legend[data-slot="field-legend"]'
                );
                if (!legend || !tabLabel) return;
                const title = legendTitleText(legend).toLowerCase();
                const matchesTab =
                    title === tabLabel ||
                    title === `${tabLabel} configuration` ||
                    title === `${tabLabel} settings`;
                if (!matchesTab) return;

                legend.dataset.settingsHiddenRoot = "1";
                legend.hidden = true;
                // Keep the section body visible — page H1 replaces this legend.
                fs.removeAttribute("data-collapsed");
                const group = fs.querySelector<HTMLElement>(':scope > [data-slot="field-group"]');
                if (group) group.hidden = false;
                const desc = fs.querySelector<HTMLElement>(
                    ':scope > [data-slot="field-description"]'
                );
                if (desc) {
                    const d = (desc.textContent ?? "").trim().toLowerCase();
                    if (
                        !d ||
                        d === `${tabLabel} configuration` ||
                        d.includes(`${tabLabel} configuration`)
                    ) {
                        desc.hidden = true;
                    }
                }
            }
        );
    }

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
            if (legend.dataset.settingsHiddenRoot === "1") return;
            if (legend.dataset.settingsCollapsible === "1") return;

            const directNested = content.querySelectorAll(':scope fieldset[data-slot="field-set"]');
            // Only wrap groups that contain nested objects (real sections).
            // Ranking leaf attribute bags (fetch/rank triplets) stay expanded and non-collapsible.
            if (directNested.length === 0) return;

            const depth = fieldsetDepth(fs);
            const parentFs = fs.parentElement?.closest('fieldset[data-slot="field-set"]');
            const siblings = parentFs
                ? Array.from(
                      parentFs.querySelectorAll<HTMLFieldSetElement>(
                          ':scope > [data-slot="field-group"] fieldset[data-slot="field-set"]'
                      )
                  ).filter((sib) => fieldsetDepth(sib) === depth)
                : [];
            const isFirstSibling = siblings.length > 0 ? siblings[0] === fs : !parentFs;
            // Depth 0–1 open; depth ≥2 collapsed except first sibling for scanability.
            const openByDefault = depth <= 1 || (depth === 2 && isFirstSibling);

            legend.dataset.settingsCollapsible = "1";
            legend.setAttribute("role", "button");
            legend.tabIndex = 0;
            legend.classList.add("settings-collapsible-legend");

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
        const tabId = activeTabId;
        if (!host) return;

        let dispose = () => {};
        let timer: ReturnType<typeof setTimeout> | null = null;

        const run = async () => {
            await tick();
            dispose();
            polishLegends(host, tabId);
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

    // Intercept form submit event and delegate to SJSF request runner
    $effect(() => {
        const host = formHost;
        if (!host) return;

        const formEl = host.querySelector("form");
        if (!formEl) return;

        const handleSubmit = (e: SubmitEvent) => {
            e.preventDefault();
            e.stopPropagation();
            void request.run(getValueSnapshot(form), e);
        };

        formEl.addEventListener("submit", handleSubmit);
        return () => {
            formEl.removeEventListener("submit", handleSubmit);
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
        <span class="font-medium text-emerald-600 dark:text-emerald-400"
            >Settings saved successfully.</span>
    </div>
{/if}

<div class="settings-form-host" bind:this={formHost}>
    <BasicForm
        {form}
        method="POST"
        action="?tab={activeTabId}"
        class="settings-form"
        data-settings-tab={activeTabId} />
</div>

<style>
    /**
     * Form field layout and theming.
     * Targets SJSF data-slot attributes so styles stay scoped to settings forms.
     */

    :global(.settings-form) {
        display: flex;
        flex-direction: column;
        width: 100%;
        gap: 0.75rem;
    }

    :global(.settings-form > form),
    :global(.settings-form fieldset[data-slot="field-set"]),
    :global(.settings-form [data-slot="field"]:has([data-slot="field"])),
    :global(.settings-form [data-slot="field-group"]),
    :global(.settings-form [data-layout="object-properties"]),
    :global(.settings-form [data-layout="object-property"]) {
        width: 100%;
    }

    :global(.settings-form [data-slot="field-group"]),
    :global(.settings-form [data-layout="object-properties"]) {
        display: grid !important;
        gap: 0.75rem;
        grid-template-columns: 1fr;
        width: 100%;
    }

    @media (min-width: 768px) {
        :global(.settings-form [data-slot="field-group"]),
        :global(.settings-form [data-layout="object-properties"]) {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 0.75rem;
        }

        /* Nested object / array fields span full width of the 2-column grid */
        :global(.settings-form [data-slot="field"]:has([data-slot="field"])),
        :global(.settings-form [data-slot="field-group"] > fieldset[data-slot="field-set"]),
        :global(.settings-form [data-layout="array-field"]),
        :global(.settings-form [data-layout="array-item"]),
        :global(
            .settings-form [data-layout="object-property"]:has(fieldset[data-slot="field-set"])
        ),
        :global(.settings-form [data-layout="object-property"]:has([data-layout="array-field"])),
        :global(
            .settings-form [data-slot="field-group"] > [data-slot="field"]:has([data-slot="field"])
        ) {
            grid-column: 1 / -1;
        }
    }

    /* Top-level section fieldset cards — Ranking-density surfaces */
    :global(.settings-form fieldset[data-slot="field-set"]) {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.75rem;
        min-inline-size: 0;
        border: 1px solid color-mix(in oklab, var(--color-border) 60%, transparent);
        border-radius: 0.75rem;
        background: color-mix(in oklab, var(--color-card) 40%, transparent);
        backdrop-filter: blur(4px);
        padding: 0.75rem;
        margin: 0 0 0.25rem 0;
        box-shadow: none;
    }

    @media (min-width: 768px) {
        :global(.settings-form fieldset[data-slot="field-set"]) {
            padding: 1rem;
        }
    }

    /* Provider cards: nested provider fieldsets with enabled accent.
       Note: BasicForm is <form class="settings-form"> — no nested <form>. */
    :global(
        .settings-form[data-settings-tab="scraping"]
            > fieldset[data-slot="field-set"]
            fieldset[data-slot="field-set"],
        .settings-form[data-settings-tab="downloaders"]
            > fieldset[data-slot="field-set"]
            fieldset[data-slot="field-set"],
        .settings-form[data-settings-tab="content"]
            > fieldset[data-slot="field-set"]
            fieldset[data-slot="field-set"],
        .settings-form[data-settings-tab="notifications"]
            > fieldset[data-slot="field-set"]
            fieldset[data-slot="field-set"],
        .settings-form[data-settings-tab="ops"]
            > fieldset[data-slot="field-set"]
            fieldset[data-slot="field-set"]
    ) {
        border-color: color-mix(in oklab, var(--color-border) 70%, transparent);
        background: linear-gradient(
            135deg,
            color-mix(in oklab, var(--color-card) 55%, transparent),
            color-mix(in oklab, var(--color-primary) 4%, transparent)
        );
    }

    /* SJSF boolean fields render as checkbox buttons — accent nested provider cards when Enabled is on */
    :global(
        .settings-form[data-settings-tab="scraping"]
            fieldset[data-slot="field-set"]:has(legend[data-settings-enabled="1"]),
        .settings-form[data-settings-tab="downloaders"]
            fieldset[data-slot="field-set"]:has(legend[data-settings-enabled="1"]),
        .settings-form[data-settings-tab="content"]
            fieldset[data-slot="field-set"]:has(legend[data-settings-enabled="1"]),
        .settings-form[data-settings-tab="notifications"]
            fieldset[data-slot="field-set"]:has(legend[data-settings-enabled="1"]),
        .settings-form[data-settings-tab="ops"]
            fieldset[data-slot="field-set"]:has(legend[data-settings-enabled="1"])
    ) {
        border-color: color-mix(in oklab, var(--color-primary) 35%, var(--color-border));
        box-shadow:
            0 0 0 1px color-mix(in oklab, var(--color-primary) 18%, transparent),
            0 1px 3px color-mix(in oklab, var(--color-black) 8%, transparent);
    }

    :global(
        .settings-form[data-settings-tab="scraping"] legend[data-slot="field-legend"]::after,
        .settings-form[data-settings-tab="downloaders"] legend[data-slot="field-legend"]::after,
        .settings-form[data-settings-tab="content"] legend[data-slot="field-legend"]::after,
        .settings-form[data-settings-tab="notifications"] legend[data-slot="field-legend"]::after,
        .settings-form[data-settings-tab="ops"] legend[data-slot="field-legend"]::after
    ) {
        content: none;
    }

    :global(.settings-form legend[data-slot="field-legend"][data-settings-enabled="1"]::after) {
        content: "Enabled";
        margin-left: auto;
        font-size: 0.65rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: color-mix(in oklab, var(--color-primary) 90%, white);
        background: color-mix(in oklab, var(--color-primary) 18%, transparent);
        border: 1px solid color-mix(in oklab, var(--color-primary) 30%, transparent);
        border-radius: 999px;
        padding: 0.15rem 0.45rem;
    }

    :global(.settings-form legend[data-slot="field-legend"]) {
        float: none;
        display: flex;
        align-items: center;
        justify-content: flex-start !important;
        gap: 0.5rem;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        text-align: left;
        /* Ranking-adjacent: plain dense section title (no heavy left accent) */
        font-size: 0.875rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        margin: 0 0 0.5rem;
        padding: 0 0 0.5rem;
        border-bottom: 1px solid color-mix(in oklab, var(--color-border) 60%, transparent);
        border-left: none;
        color: var(--color-foreground);
    }

    /* SJSF title row must not push the label to the far right */
    :global(.settings-form legend[data-slot="field-legend"] [data-layout="object-field-title-row"]),
    :global(.settings-form legend[data-slot="field-legend"] .justify-between) {
        display: flex;
        align-items: center;
        justify-content: flex-start !important;
        gap: 0.5rem;
        width: auto;
        max-width: 100%;
        flex: 1 1 auto;
        min-width: 0;
    }

    :global(.settings-form legend[data-slot="field-legend"][data-settings-hidden-root="1"]) {
        display: none !important;
    }

    :global(.settings-form legend.settings-collapsible-legend) {
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        justify-content: flex-start !important;
        gap: 0.5rem;
        border-radius: 0.5rem;
        padding: 0.35rem 0.5rem 0.5rem;
        margin-left: -0.5rem;
        margin-right: -0.5rem;
        width: calc(100% + 1rem);
        max-width: none;
        transition: background 0.15s ease;
    }

    :global(.settings-form legend.settings-collapsible-legend:hover) {
        background: color-mix(in oklab, var(--color-primary) 12%, var(--color-muted));
    }

    :global(.settings-form legend.settings-collapsible-legend::before) {
        content: "▾";
        display: inline-block;
        font-size: 0.75rem;
        opacity: 0.75;
        transition: transform 0.15s ease;
        flex-shrink: 0;
        order: -1;
    }

    :global(.settings-form fieldset[data-collapsed] > legend.settings-collapsible-legend::before) {
        transform: rotate(-90deg);
    }

    /* Collapsed sections: one compact header row, no hollow card body */
    :global(.settings-form fieldset[data-collapsed]) {
        gap: 0;
        padding-top: 0.65rem;
        padding-bottom: 0.65rem;
        min-height: 0;
    }

    :global(.settings-form fieldset[data-collapsed] > legend[data-slot="field-legend"]) {
        margin-bottom: 0;
        padding-bottom: 0;
        border-bottom: none;
    }

    :global(.settings-form fieldset[data-collapsed] > [data-slot="field-description"]) {
        display: none !important;
    }

    /* Individual property fields — flat rows, no card wall */
    :global(.settings-form [data-slot="field"]) {
        border: none;
        border-radius: 0;
        background: transparent;
        padding: 0.35rem 0;
        min-width: 0;
        gap: 0.35rem;
        transition: none;
    }

    :global(.settings-form [data-slot="field"]:hover) {
        border-color: transparent;
        background: transparent;
    }

    :global(.settings-form fieldset[data-slot="field-set"] > [data-slot="field-group"]) {
        padding-top: 0.5rem;
        padding-left: 0.25rem;
    }

    :global(.settings-form [data-slot="field"] [data-slot="field"]) {
        background: transparent;
        border: none;
    }

    :global(.settings-form [data-slot="field-label"]) {
        font-weight: 600;
        font-size: 0.875rem;
        color: var(--color-foreground);
    }

    /* Descriptions live in label tooltips — hide inline prose to cut noise */
    :global(.settings-form [data-slot="field-description"]) {
        display: none !important;
    }

    /* Fieldset-level description under legend stays visible (section context) */
    :global(.settings-form legend[data-slot="field-legend"] + [data-slot="field-description"]),
    :global(.settings-form fieldset[data-slot="field-set"] > [data-slot="field-description"]) {
        display: block !important;
        color: var(--color-muted-foreground);
        font-size: 0.75rem;
        line-height: 1.4;
        margin: -0.25rem 0 0.5rem;
    }

    :global(.settings-form [data-slot="input"]),
    :global(.settings-form [data-slot="textarea"]),
    :global(.settings-form [data-slot="select-trigger"]) {
        width: 100%;
        min-width: 0;
        min-height: 2.25rem;
        border-radius: 0.375rem;
        background: color-mix(in oklab, var(--color-background) 70%, transparent);
        border: 1px solid color-mix(in oklab, var(--color-input) 80%, transparent);
        font-size: 0.875rem;
    }

    :global(.settings-form :focus-visible) {
        outline: 2px solid var(--color-ring);
        outline-offset: 2px;
    }

    :global(.settings-form [data-slot="field-error"]) {
        font-size: 0.78rem;
        margin-top: 0.25rem;
    }

    :global(.settings-form [data-settings-focus="true"]),
    :global([data-settings-search-path][data-settings-focus="true"]) {
        border-radius: 0.5rem;
        box-shadow:
            0 0 0 2px color-mix(in oklab, var(--color-primary) 35%, transparent),
            0 0 0 6px color-mix(in oklab, var(--color-primary) 12%, transparent);
        transition: box-shadow 0.25s ease;
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

    /* Boolean rows: label left, control right (switch or checkbox button) */
    :global(.settings-form [data-slot="field"]:has(button[role="switch"])),
    :global(.settings-form [data-slot="field"]:has(button[data-slot="checkbox"])),
    :global(.settings-form [data-slot="field"]:has(input[type="checkbox"])) {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid color-mix(in oklab, var(--color-border) 40%, transparent);
    }

    :global(
        .settings-form
            [data-slot="field"]:has(button[role="switch"])
            > [data-slot="field-label-group"],
        .settings-form
            [data-slot="field"]:has(button[data-slot="checkbox"])
            > [data-slot="field-label-group"],
        .settings-form
            [data-slot="field"]:has(input[type="checkbox"])
            > [data-slot="field-label-group"]
    ) {
        flex: 1;
        min-width: 0;
        order: 0;
    }

    :global(.settings-form [data-slot="field"]:has(button[role="switch"]) button[role="switch"]),
    :global(
        .settings-form
            [data-slot="field"]:has(button[data-slot="checkbox"])
            button[data-slot="checkbox"]
    ),
    :global(.settings-form [data-slot="field"]:has(input[type="checkbox"]) input[type="checkbox"]) {
        order: 1;
        flex-shrink: 0;
    }

    /* Leaf scalar fields stretch to fill their grid cell */
    :global(.settings-form [data-slot="field"]:not(:has([data-slot="field"]))) {
        display: flex;
        flex-direction: column;
        width: 100%;
    }

    :global(
        .settings-form
            [data-slot="field"]:has(button[role="switch"]):not(:has([data-slot="field"])),
        .settings-form
            [data-slot="field"]:has(button[data-slot="checkbox"]):not(:has([data-slot="field"])),
        .settings-form
            [data-slot="field"]:has(input[type="checkbox"]):not(:has([data-slot="field"]))
    ) {
        flex-direction: row;
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
</style>
