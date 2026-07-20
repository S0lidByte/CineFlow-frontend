import {
    buildSectionSearchEntries,
    buildRankingShortcutEntries,
    buildFieldIndexFromSchema,
    mergeSearchEntries,
    filterSearchEntries
} from "../src/lib/components/settings/settings-field-index.ts";
import { SETTINGS_TABS, getTabIdForSettingsKey } from "../src/lib/components/settings/sections.ts";

const rankingTab = SETTINGS_TABS.find((t) => t.id === "ranking");
if (!rankingTab || rankingTab.keys.join(",") !== "ranking") throw new Error("ranking tab missing");
const scraping = SETTINGS_TABS.find((t) => t.id === "scraping");
if (!scraping || scraping.keys.includes("ranking")) throw new Error("ranking still in scraping");
if (getTabIdForSettingsKey("ranking") !== "ranking") throw new Error("tab map fail");

const fakeSchema = {
    properties: {
        ranking: {
            type: "object",
            properties: {
                options: {
                    type: "object",
                    properties: {
                        remove_all_trash: {
                            type: "boolean",
                            description: "trash help",
                            title: "Remove all trash"
                        }
                    }
                },
                custom_ranks: {
                    type: "object",
                    properties: {
                        audio: {
                            type: "object",
                            properties: {
                                dolby_digital_plus: {
                                    type: "object",
                                    title: "Dolby Digital Plus (DDP)",
                                    description: "Log: denied by: audio_dolby_digital_plus"
                                }
                            }
                        }
                    }
                }
            }
        },
        scraping: { type: "object", properties: { after_2d: { type: "number", title: "After 2d" } } }
    }
};

const index = mergeSearchEntries(
    buildSectionSearchEntries(),
    buildRankingShortcutEntries(),
    buildFieldIndexFromSchema(fakeSchema)
);
const ddp = filterSearchEntries(index, "audio_dolby_digital_plus");
if (!ddp.some((e) => e.path?.includes("dolby_digital_plus"))) {
    throw new Error("ddp search fail: " + JSON.stringify(ddp));
}
const remux = filterSearchEntries(index, "quality_remux");
if (!remux.length) throw new Error("remux shortcut fail");
const sectionsOnly = filterSearchEntries(index, "");
if (!sectionsOnly.every((e) => e.kind === "section")) throw new Error("empty query should be sections");
console.log("FE_INDEX_OK", {
    entries: index.length,
    ddpHits: ddp.length,
    remuxHits: remux.length,
    sections: sectionsOnly.length,
    tabs: SETTINGS_TABS.map((t) => t.id).join(",")
});
