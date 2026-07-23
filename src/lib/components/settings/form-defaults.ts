export { translation } from "@sjsf/form/translations/en";

export { resolver } from "@sjsf/form/resolvers/basic";
import "@sjsf/form/fields/extra/enum-include";
import "@sjsf/form/fields/extra/multi-enum-include";
import "@sjsf/form/fields/extra/unknown-native-file-include";

import { extendByRecord } from "@sjsf/form/lib/resolver";
import { theme as baseTheme } from "@sjsf/shadcn4-theme";
import ApiKeyWidget from "./api-key-widget.svelte";
import SettingsDescription from "./settings-description.svelte";
import SettingsLabel from "./settings-label.svelte";
import SettingsSubmitButton from "./settings-submit-button.svelte";

export const theme = extendByRecord(baseTheme, {
    apiKeyWidget: ApiKeyWidget,
    description: SettingsDescription,
    label: SettingsLabel,
    // Page shell owns Save chrome; suppress SJSF's default Submit button.
    submitButton: SettingsSubmitButton
});

import "@sjsf/shadcn4-theme/extra-widgets/textarea-include";
import "@sjsf/shadcn4-theme/extra-widgets/checkboxes-include";
import "@sjsf/shadcn4-theme/extra-widgets/radio-include";
import "@sjsf/shadcn4-theme/extra-widgets/file-include";
import "@sjsf/shadcn4-theme/extra-widgets/date-picker-include";
// import "@sjsf-lab/shadcn-extras-theme/extra-widgets/password-include";
// import "@sjsf-lab/shadcn-extras-theme/extra-widgets/tags-input-include";

export { createFormIdBuilder as idBuilder } from "@sjsf/sveltekit";

export { createFormMerger as merger } from "@sjsf/form/mergers/modern";

import type { ValidatorFactoryOptions } from "@sjsf/form";
import { addFormComponents, createFormValidator } from "@sjsf/ajv8-validator";
import addFormats from "ajv-formats";

const PATH_FORMAT_REGEX = /^[/.].*/;
const MULTI_HOST_URI_REGEX = /^.+$/;

export const validator = <T>(options: ValidatorFactoryOptions & { ajvOptions?: Record<string, unknown> }) =>
    createFormValidator<T>({
        ...options,
        ajvOptions: {
            coerceTypes: true,
            useDefaults: true,
            ...options?.ajvOptions
        },
        ajvPlugins: (ajv) => {
            addFormComponents(addFormats(ajv));

            ajv.addFormat("path", PATH_FORMAT_REGEX);
            ajv.addFormat("multi-host-uri", MULTI_HOST_URI_REGEX);

            return ajv;
        }
    });
