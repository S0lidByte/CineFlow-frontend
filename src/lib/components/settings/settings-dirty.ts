import { writable } from "svelte/store";

/**
 * Dirty-state contract for custom settings panels (Library Profiles, Ranking).
 *
 * The settings shell merges this with SJSF `form.isChanged` for:
 * - tab-switch discard confirmation
 * - sticky save bar / header status on custom tabs that report here
 */
export type CustomDirtyState = {
    isDirty: boolean;
    /** Reset local edits to the last saved baseline. */
    discard: () => void;
} | null;

export const customDirtyStore = writable<CustomDirtyState>(null);

/** Clear custom dirty state (call on tab change / unmount). */
export function clearCustomDirty(): void {
    customDirtyStore.set(null);
}
