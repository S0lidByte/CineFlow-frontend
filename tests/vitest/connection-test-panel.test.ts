import { expect, test } from "vitest";
import { render } from "svelte/server";
import ConnectionTestPanel from "../../src/lib/components/settings/connection-test-panel.svelte";

test("SSR renders all connection probes disabled before mount", () => {
    const { body } = render(ConnectionTestPanel, {
        props: {
            services: [
                { id: "all_debrid", label: "AllDebrid", hint: "Saved settings" },
                { id: "plex", label: "Plex", hint: "Saved settings" }
            ]
        }
    });
    const buttons = body.match(/<button\b(?:"[^"]*"|'[^']*'|[^'">])*>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const button of buttons) expect(button).toMatch(/\sdisabled(?:\s|=|>)/);
    expect(body.match(/Not tested/g)).toHaveLength(2);
    expect(body).not.toContain("Testing…");
});

test("empty service list renders no connection controls", () => {
    const { body } = render(ConnectionTestPanel, { props: { services: [] } });
    expect(body).not.toContain("<button");
    expect(body).not.toContain("Connection tests");
});
