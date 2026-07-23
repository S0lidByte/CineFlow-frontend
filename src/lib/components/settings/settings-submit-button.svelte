<script lang="ts">
    /**
     * Hidden SJSF submit button.
     * The settings page shell owns Save (header + sticky bar) and calls
     * requestSubmit() on the underlying form. Rendered hidden so ENTER-key
     * form submissions still work natively without displaying a giant button.
     */
    import type { ComponentProps } from "@sjsf/form";

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- theme contract
    const props: ComponentProps["submitButton"] = $props();
</script>

<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
