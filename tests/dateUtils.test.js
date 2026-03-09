/**
 * Unit tests for lib/dateUtils.js (date normalization for cta_attendance).
 * Run: npm test
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  formatManilaDate,
  normalizeDateInput,
  normalizeDateForComparison
} = require("../lib/dateUtils");

describe("dateUtils", () => {
  describe("normalizeDateInput", () => {
    it("trims whitespace", () => {
      assert.strictEqual(normalizeDateInput("  03-09-26  "), "03-09-26");
    });
    it("returns empty string for null/undefined", () => {
      assert.strictEqual(normalizeDateInput(null), "");
      assert.strictEqual(normalizeDateInput(undefined), "");
    });
  });

  describe("normalizeDateForComparison", () => {
    it("leaves MM-DD-YY unchanged", () => {
      assert.strictEqual(normalizeDateForComparison("03-09-26"), "03-09-26");
    });
    it("converts MM-DD-YYYY to MM-DD-YY", () => {
      assert.strictEqual(normalizeDateForComparison("03-09-2026"), "03-09-26");
    });
    it("pads month and day to two digits", () => {
      assert.strictEqual(normalizeDateForComparison("3-9-26"), "03-09-26");
      assert.strictEqual(normalizeDateForComparison("3-9-2026"), "03-09-26");
    });
    it("returns empty string for empty input", () => {
      assert.strictEqual(normalizeDateForComparison(""), "");
      assert.strictEqual(normalizeDateForComparison("   "), "");
    });
    it("returns unchanged string for invalid format (no match)", () => {
      assert.strictEqual(normalizeDateForComparison("2026-03-09"), "2026-03-09");
      assert.strictEqual(normalizeDateForComparison("not-a-date"), "not-a-date");
    });
  });

  describe("formatManilaDate", () => {
    it("returns MM-DD-YY format", () => {
      const d = new Date("2026-03-09T08:00:00.000Z");
      const result = formatManilaDate(d);
      assert.match(result, /^\d{2}-\d{2}-\d{2}$/);
    });
    it("accepts number timestamp", () => {
      const result = formatManilaDate(1741564800000);
      assert.match(result, /^\d{2}-\d{2}-\d{2}$/);
    });
  });

  describe("normalizeDateForComparison vs formatManilaDate", () => {
    it("normalized 03-09-2026 matches formatManilaDate for same day", () => {
      const d = new Date("2026-03-09T15:00:00.000Z");
      const manilaStr = formatManilaDate(d);
      const normalized = normalizeDateForComparison("03-09-2026");
      assert.strictEqual(normalized, manilaStr);
    });
  });
});
