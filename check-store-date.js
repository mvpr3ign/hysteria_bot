/**
 * Check store for CTAs on a specific date (Manila time).
 * Works with both legacy store.json and new data/ structure.
 * Usage: node check-store-date.js [MM-DD-YY]
 * Example: node check-store-date.js 03-09-26
 * If no date is given, uses today (Manila).
 */

const path = require("path");
const { getStore } = require("./store");

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

const formatManilaTimestamp = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(d);
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "00";
  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const second = parts.find((p) => p.type === "second")?.value || "00";
  return `${month}-${day}-${year} ${hour}:${minute}:${second}`;
};

const normalizeDateForComparison = (dateStr) => {
  const s = (dateStr || "").trim();
  if (!s) return s;
  const match = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (!match) return s;
  const [, month, day, year] = match;
  const twoDigitYear = year.length === 4 ? year.slice(-2) : year;
  return `${month.padStart(2, "0")}-${day.padStart(2, "0")}-${twoDigitYear}`;
};

const getDateArg = () => {
  const arg = process.argv[2];
  if (arg) return normalizeDateForComparison(arg);
  const now = new Date();
  return formatManilaDate(now);
};

const main = () => {
  const store = getStore();
  const dateFilter = getDateArg();

  console.log("Data root:", path.join(__dirname, "data"));
  console.log("Date filter (MM-DD-YY, Manila):", dateFilter);
  console.log("");

  const fromHistory = (store.ctaHistory || []).filter(
    (entry) => formatManilaDate(new Date(entry.createdAt)) === dateFilter
  );
  const fromActive = Object.entries(store.activeCtas || {}).filter(
    ([, cta]) => formatManilaDate(new Date(cta.createdAt)) === dateFilter
  );

  const all = [
    ...fromHistory.map((e) => ({ ...e, source: "ctaHistory" })),
    ...fromActive.map(([channelId, cta]) => ({ ...cta, channelId, source: "activeCtas" }))
  ].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  console.log("--- ctaHistory (closed, from data/ctas/) ---");
  console.log("Count:", fromHistory.length);
  fromHistory.forEach((entry, i) => {
    const ts = formatManilaTimestamp(new Date(entry.createdAt));
    console.log(`  ${i + 1}. ${ts} - ${entry.eventType || "?"} (channelId: ${entry.channelId || "?"}, attendees: ${(entry.attendees || []).length})`);
  });

  console.log("");
  console.log("--- activeCtas (from data/activeCtas.json) ---");
  console.log("Count:", fromActive.length);
  fromActive.forEach(([channelId, cta], i) => {
    const ts = formatManilaTimestamp(new Date(cta.createdAt));
    const expired = Date.now() >= (cta.expiresAt || 0);
    console.log(`  ${i + 1}. ${ts} - ${cta.eventType || "?"} (channelId: ${channelId}, expired: ${expired}, attendees: ${(cta.attendees || []).length})`);
  });

  console.log("");
  console.log("--- Combined (as cta_attendance would show) ---");
  console.log("Total for this date:", all.length);
  all.forEach((entry, i) => {
    const ts = formatManilaTimestamp(new Date(entry.createdAt));
    console.log(`  ${i + 1}. ${ts} - ${entry.eventType || "Unknown"}`);
  });
};

main();
