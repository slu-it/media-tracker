import { describe, expect, it, vi } from "vitest";
import { isLanguage, LANGUAGE_STORAGE_KEY, readStoredLanguage, writeStoredLanguage } from "./language";

describe("isLanguage", () => {
  it("accepts en and de", () => {
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("de")).toBe(true);
  });

  it("rejects other strings and non-strings", () => {
    expect(isLanguage("fr")).toBe(false);
    expect(isLanguage("")).toBe(false);
    expect(isLanguage(null)).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
    expect(isLanguage(1)).toBe(false);
  });
});

describe("readStoredLanguage", () => {
  it("returns null when nothing is stored", () => {
    expect(readStoredLanguage()).toBeNull();
  });

  it("returns null for an invalid stored value", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    expect(readStoredLanguage()).toBeNull();
  });

  it("returns the stored value when valid", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "de");
    expect(readStoredLanguage()).toBe("de");
  });

  it("returns null when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readStoredLanguage()).toBeNull();
  });
});

describe("writeStoredLanguage", () => {
  it("stores the value", () => {
    writeStoredLanguage("de");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("de");
  });

  it("swallows a throwing localStorage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeStoredLanguage("de")).not.toThrow();
  });
});
