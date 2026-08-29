/**
 * Shared icon map for the Settings page.
 *
 * Maps the `icon` string stored in {@link SectionTab} and {@link SECTION_GROUPS}
 * to the corresponding Lucide Svelte component. Extracted from `+page.svelte` so
 * both the page shell and the settings search palette can import it without duplication.
 */
import type { Component } from "svelte";
import Settings from "@lucide/svelte/icons/settings";
import Settings2 from "@lucide/svelte/icons/settings-2";
import FolderTree from "@lucide/svelte/icons/folder-tree";
import Library from "@lucide/svelte/icons/library";
import Download from "@lucide/svelte/icons/download";
import FileText from "@lucide/svelte/icons/file-text";
import ScanSearch from "@lucide/svelte/icons/scan-search";
import Server from "@lucide/svelte/icons/server";
import BookOpen from "@lucide/svelte/icons/book-open";
import ListOrdered from "@lucide/svelte/icons/list-ordered";
import Database from "@lucide/svelte/icons/database";
import Bell from "@lucide/svelte/icons/bell";
import Activity from "@lucide/svelte/icons/activity";
import Layers from "@lucide/svelte/icons/layers";
import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";
import Users from "@lucide/svelte/icons/users";

export const ICON_MAP: Record<string, Component> = {
    // Tab icons
    settings: Settings,
    users: Users,
    "folder-tree": FolderTree,
    library: Library,
    download: Download,
    "file-text": FileText,
    "scan-search": ScanSearch,
    "list-ordered": ListOrdered,
    server: Server,
    "book-open": BookOpen,
    database: Database,
    bell: Bell,
    activity: Activity,
    // Group header icons
    "settings-2": Settings2,
    layers: Layers,
    "sliders-horizontal": SlidersHorizontal
};
