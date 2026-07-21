/**
 * Shared icon map for the Settings page.
 *
 * Maps the `icon` string stored in {@link SectionTab} to the corresponding
 * Lucide Svelte component. Extracted from `+page.svelte` so both the page
 * shell and the settings search palette can import it without duplication.
 */
import type { Component } from "svelte";
import Settings from "@lucide/svelte/icons/settings";
import FolderTree from "@lucide/svelte/icons/folder-tree";
import Library from "@lucide/svelte/icons/library";
import Download from "@lucide/svelte/icons/download";
import FileText from "@lucide/svelte/icons/file-text";
import ScanSearch from "@lucide/svelte/icons/scan-search";
import Server from "@lucide/svelte/icons/server";
import BookOpen from "@lucide/svelte/icons/book-open";
import ListOrdered from "@lucide/svelte/icons/list-ordered";

export const ICON_MAP: Record<string, Component> = {
    settings: Settings,
    "folder-tree": FolderTree,
    library: Library,
    download: Download,
    "file-text": FileText,
    "scan-search": ScanSearch,
    "list-ordered": ListOrdered,
    server: Server,
    "book-open": BookOpen
};
