import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, getIntlLocale, isLocale, messages } from "@/lib/i18n";

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
});
