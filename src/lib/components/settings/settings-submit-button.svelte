<script lang="ts">
    /**
     * No-op SJSF submit button.
     * The settings page shell owns Save (header + sticky bar) and calls
     * requestSubmit() on the underlying form, so the default orange Submit
     * chrome is redundant and confusing.
     */
    import type { ComponentProps } from "@sjsf/form";

    // Accept SJSF props for theme contract; intentionally unused (no UI).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- theme contract
    const props: ComponentProps["submitButton"] = $props();
</script>
