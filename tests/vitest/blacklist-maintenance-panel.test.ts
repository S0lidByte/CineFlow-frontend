import { expect, test } from "vitest";
import { render } from "svelte/server";
import BlacklistMaintenancePanel from "../../src/lib/components/settings/blacklist-maintenance-panel.svelte";

test("global reset is disabled until a count has been obtained", () => {
    const { body } = render(BlacklistMaintenancePanel);
    const buttons = body.match(/<button\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?<\/button>/g) ?? [];
    const clear = buttons.find((button) => button.includes("Clear All Blacklisted Streams"));
    expect(clear).toBeDefined();
    expect(clear).toMatch(/\sdisabled(?:\s|=|>)/);
    expect(body).toContain("Blacklisted Streams Maintenance");
    expect(body).not.toContain('role="alertdialog"');
});
