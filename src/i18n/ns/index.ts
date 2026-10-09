/**
 * Translations split by area of the app, one file each, merged into the dictionaries.
 * Add a file here and list it below: its keys become `t.<name>` everywhere.
 */
import { academics } from "@/i18n/ns/academics";
import { workspace } from "@/i18n/ns/workspace";
import { modulesA } from "@/i18n/ns/modulesA";
import { modulesB } from "@/i18n/ns/modulesB";
import { settingsUi } from "@/i18n/ns/settingsUi";

export const NAMESPACES = { academics, workspace, modulesA, modulesB, settingsUi } as const;
