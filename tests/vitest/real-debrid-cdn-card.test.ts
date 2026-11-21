import { expect, test } from "vitest";
import { render } from "svelte/server";
import RealDebridCdnCard from "../../src/lib/components/settings/real-debrid-cdn-card.svelte";
import { SETTINGS_TAB_GUIDES } from "../../src/lib/components/settings/settings-tab-guides";

test("SSR renders RealDebridCdnCard with 4K Remux guidance and links", () => {
    const { body } = render(RealDebridCdnCard);

    expect(body).toContain("Real-Debrid CDN Optimization");
    expect(body).toContain("4K / Remux Recommended");
    expect(body).toContain("Cloudflare CDN");
    expect(body).toContain("https://real-debrid.com/speedtest");
    expect(body).toContain("https://real-debrid.com/account");
    expect(body).toContain("Parallel Prefetch Workers");
});

test("downloaders tab guide contains Cloudflare CDN recommendations", () => {
    const guide = SETTINGS_TAB_GUIDES.downloaders;
    expect(guide).toBeDefined();

    const guideText = JSON.stringify(guide);
    expect(guideText).toContain("Cloudflare");
    expect(guideText).toContain("speedtest");
    expect(guideText).toContain("Parallel Prefetch Workers");
});

test("ops tab guide contains Parallel Prefetch Workers bandwidth guidance", () => {
    const guide = SETTINGS_TAB_GUIDES.ops;
    expect(guide).toBeDefined();

    const tipsText = guide.tips?.join(" ") ?? "";
    expect(tipsText).toContain("Parallel Prefetch Workers");
    expect(tipsText).toContain("non-Cloudflare CDNs");
});
