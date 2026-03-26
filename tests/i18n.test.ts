import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, getIntlLocale, isLocale, messages } from "@/lib/i18n";

const translationMarkerPattern =
  /\b(?:translation missing|missing translation|todo|fixme|tbd|placeholder|translate me)\b|__[^_\s]+__|\[\[[^\]]+\]\]/i;

function flattenMessages(value: unknown, path = ""): Array<[string, string]> {
  if (typeof value === "string") {
    return [[path, value]];
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    flattenMessages(nestedValue, path ? `${path}.${key}` : key),
  );
}

describe("i18n foundation", () => {
  it("defaults to German", () => {
    expect(DEFAULT_LOCALE).toBe("de");
    expect(messages.de.meta.title).toBe("Saatgut");
  });

  it("recognizes supported locales", () => {
    expect(isLocale("de")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
  });

  it("maps locales to Intl identifiers", () => {
    expect(getIntlLocale("de")).toBe("de-DE");
    expect(getIntlLocale("en")).toBe("en-US");
  });

  it("keeps the German and English catalogs structurally aligned", () => {
    const germanPaths = flattenMessages(messages.de).map(([path]) => path).sort();
    const englishPaths = flattenMessages(messages.en).map(([path]) => path).sort();

    expect(germanPaths).toEqual(englishPaths);
  });

  it("does not ship translation placeholders or missing-string markers", () => {
    const catalogs = Object.entries(messages).flatMap(([locale, catalog]) =>
      flattenMessages(catalog).map(([path, value]) => ({ locale, path, value })),
    );

    const flagged = catalogs.filter(({ value }) => translationMarkerPattern.test(value.trim()));

    expect(flagged).toEqual([]);
  });

  it("keeps visible German-first shell copy translated in the default locale", () => {
    expect(messages.de.locale.switchLabel).toBe("Sprache");
    expect(messages.de.auth.createWorkspace).toBe("Arbeitsbereich anlegen");
    expect(messages.de.nav.dashboard).toBe("Übersicht");
    expect(messages.de.nav.catalog).toBe("Katalog");
    expect(messages.de.dashboard.calendarTitle).toBe("14-Tage-Kalender");
    expect(messages.de.catalog.seedBatchesTitle).toBe("Chargen und Prüfungen");
    expect(messages.de.plantings.title).toBe("Ereignis erfassen");
  });
});
