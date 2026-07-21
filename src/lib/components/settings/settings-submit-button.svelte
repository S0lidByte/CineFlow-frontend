<script lang="ts">
    /**
     * No-op SJSF submit button.
     * The settings page shell owns Save (header + sticky bar) and calls
     * requestSubmit() on the underlying form, so the default orange Submit
     * chrome is redundant and confusing.
     */
    import type { ComponentProps } from "@sjsf/form";

    // Accept SJSF props; intentionally render nothing.
    let { children: _children, config: _config }: ComponentProps["submitButton"] = $props();
</script>
