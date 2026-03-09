/**
 * Date helpers for Manila timezone and CTA date comparison.
 * Used by index.js and tests.
 */

const formatManilaDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "2-digit",
    day: "2-digit",
    year: "2-digit"
  }).formatToParts(d);
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "00";
  return `${month}-${day}-${year}`;
};

const normalizeDateInput = (value) => (value || "").trim();

/**
 * Normalize date string to MM-DD-YY for comparison with formatManilaDate output.
 * Accepts MM-DD-YY or MM-DD-YYYY.
 */
const normalizeDateForComparison = (dateStr) => {
  const s = normalizeDateInput(dateStr);
  if (!s) return s;
  const match = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (!match) return s;
  const [, month, day, year] = match;
  const twoDigitYear = year.length === 4 ? year.slice(-2) : year;
  return `${month.padStart(2, "0")}-${day.padStart(2, "0")}-${twoDigitYear}`;
};

module.exports = {
  formatManilaDate,
  normalizeDateInput,
  normalizeDateForComparison
};
