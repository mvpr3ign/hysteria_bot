const fs = require("fs");
const path = require("path");

const ROOT_DIR = process.env.STORE_ROOT || __dirname;
const LEGACY_STORE_PATH = path.join(ROOT_DIR, "store.json");
const DATA_DIR = path.join(ROOT_DIR, "data");
const CTAS_DIR = path.join(DATA_DIR, "ctas");
const USERS_DIR = path.join(DATA_DIR, "users");
const LOGS_DIR = path.join(ROOT_DIR, "logs");
const EVENT_POINTS_PATH = path.join(DATA_DIR, "eventPoints.json");
const ACTIVE_CTAS_PATH = path.join(DATA_DIR, "activeCtas.json");
const AUDIT_LOG_PATH = path.join(LOGS_DIR, "audit.json");

const defaultEventPoints = {
  CW1: 2,
  CW2: 3,
  CW3: 4,
  EPB: 3,
  PBS: 1
};

const defaultStore = {
  eventPoints: { ...defaultEventPoints },
  activeCtas: {},
  ctaHistory: [],
  attendance: {},
  auditLog: []
};

/** Manila time date as YYYY-MM-DD for file names */
const formatManilaDateFile = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  }).formatToParts(d);
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  return `${year}-${month}-${day}`;
};

const ensureDirs = () => {
  [DATA_DIR, CTAS_DIR, USERS_DIR, LOGS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

const useLegacyStore = () => {
  return fs.existsSync(LEGACY_STORE_PATH) && !fs.existsSync(DATA_DIR);
};

const readLegacyStore = () => {
  if (!fs.existsSync(LEGACY_STORE_PATH)) return null;
  try {
    const raw = fs.readFileSync(LEGACY_STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return { ...defaultStore, ...parsed };
  } catch (error) {
    console.error("store: failed to read legacy store.json:", error.message);
    return null;
  }
};

const migrateFromLegacy = (legacy) => {
  ensureDirs();
  const store = { ...defaultStore, ...legacy };

  fs.writeFileSync(EVENT_POINTS_PATH, JSON.stringify(store.eventPoints || defaultEventPoints, null, 2));
  fs.writeFileSync(ACTIVE_CTAS_PATH, JSON.stringify(store.activeCtas || {}, null, 2));
  fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(store.auditLog || [], null, 2));

  const users = store.attendance || {};
  Object.entries(users).forEach(([userId, data]) => {
    const userPath = path.join(USERS_DIR, `${userId}.json`);
    fs.writeFileSync(userPath, JSON.stringify(data, null, 2));
  });

  const byDate = {};
  (store.ctaHistory || []).forEach((entry) => {
    const key = formatManilaDateFile(entry.createdAt);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(entry);
  });
  Object.entries(byDate).forEach(([dateKey, entries]) => {
    const ctasPath = path.join(CTAS_DIR, `${dateKey}.json`);
    fs.writeFileSync(ctasPath, JSON.stringify(entries, null, 2));
  });

  try {
    fs.renameSync(LEGACY_STORE_PATH, path.join(ROOT_DIR, "store.json.bak"));
    console.log("store: migrated store.json to new structure (backup: store.json.bak)");
  } catch (e) {
    console.warn("store: could not rename store.json to .bak:", e.message);
  }
};

const readEventPoints = () => {
  if (!fs.existsSync(EVENT_POINTS_PATH)) return { ...defaultEventPoints };
  try {
    const raw = fs.readFileSync(EVENT_POINTS_PATH, "utf-8");
    return { ...defaultEventPoints, ...JSON.parse(raw) };
  } catch (error) {
    return { ...defaultEventPoints };
  }
};

const readActiveCtas = () => {
  if (!fs.existsSync(ACTIVE_CTAS_PATH)) return {};
  try {
    const raw = fs.readFileSync(ACTIVE_CTAS_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
};

const readAuditLog = () => {
  if (!fs.existsSync(AUDIT_LOG_PATH)) return [];
  try {
    const raw = fs.readFileSync(AUDIT_LOG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const readAttendance = () => {
  const attendance = {};
  if (!fs.existsSync(USERS_DIR)) return attendance;
  const files = fs.readdirSync(USERS_DIR);
  files.forEach((file) => {
    if (!file.endsWith(".json")) return;
    const userId = path.basename(file, ".json");
    try {
      const raw = fs.readFileSync(path.join(USERS_DIR, file), "utf-8");
      attendance[userId] = JSON.parse(raw);
    } catch (error) {
      console.error(`store: failed to read user ${userId}:`, error.message);
    }
  });
  return attendance;
};

const readCtaHistory = () => {
  const all = [];
  if (!fs.existsSync(CTAS_DIR)) return all;
  const files = fs.readdirSync(CTAS_DIR);
  files.forEach((file) => {
    if (!file.endsWith(".json")) return;
    try {
      const raw = fs.readFileSync(path.join(CTAS_DIR, file), "utf-8");
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) all.push(...entries);
    } catch (error) {
      console.error(`store: failed to read ctas/${file}:`, error.message);
    }
  });
  all.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  return all;
};

const readAll = () => {
  ensureDirs();
  return {
    eventPoints: readEventPoints(),
    activeCtas: readActiveCtas(),
    ctaHistory: readCtaHistory(),
    attendance: readAttendance(),
    auditLog: readAuditLog()
  };
};

const writeEventPoints = (eventPoints) => {
  ensureDirs();
  fs.writeFileSync(EVENT_POINTS_PATH, JSON.stringify(eventPoints || defaultEventPoints, null, 2));
};

const writeActiveCtas = (activeCtas) => {
  ensureDirs();
  fs.writeFileSync(ACTIVE_CTAS_PATH, JSON.stringify(activeCtas || {}, null, 2));
};

const writeAuditLog = (auditLog) => {
  ensureDirs();
  fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(Array.isArray(auditLog) ? auditLog : [], null, 2));
};

const writeAttendance = (attendance) => {
  ensureDirs();
  const currentIds = new Set();
  if (fs.existsSync(USERS_DIR)) {
    fs.readdirSync(USERS_DIR).forEach((f) => {
      if (f.endsWith(".json")) currentIds.add(path.basename(f, ".json"));
    });
  }
  Object.entries(attendance || {}).forEach(([userId, data]) => {
    currentIds.add(userId);
    const userPath = path.join(USERS_DIR, `${userId}.json`);
    fs.writeFileSync(userPath, JSON.stringify(data, null, 2));
  });
  currentIds.forEach((userId) => {
    if (!(attendance || {}).hasOwnProperty(userId)) {
      const userPath = path.join(USERS_DIR, `${userId}.json`);
      try {
        if (fs.existsSync(userPath)) fs.unlinkSync(userPath);
      } catch (e) {
        console.error(`store: could not remove user file ${userId}:`, e.message);
      }
    }
  });
};

const writeCtaHistory = (ctaHistory) => {
  ensureDirs();
  const byDate = {};
  (ctaHistory || []).forEach((entry) => {
    const key = formatManilaDateFile(entry.createdAt);
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(entry);
  });
  const existingFiles = fs.existsSync(CTAS_DIR) ? fs.readdirSync(CTAS_DIR) : [];
  const writtenKeys = new Set();
  Object.entries(byDate).forEach(([dateKey, entries]) => {
    writtenKeys.add(dateKey);
    const ctasPath = path.join(CTAS_DIR, `${dateKey}.json`);
    fs.writeFileSync(ctasPath, JSON.stringify(entries, null, 2));
  });
  existingFiles.forEach((file) => {
    if (!file.endsWith(".json")) return;
    const dateKey = path.basename(file, ".json");
    if (!writtenKeys.has(dateKey)) {
      try {
        fs.unlinkSync(path.join(CTAS_DIR, file));
      } catch (e) {
        console.error(`store: could not remove ctas/${file}:`, e.message);
      }
    }
  });
};

const writeAll = (store) => {
  writeEventPoints(store.eventPoints);
  writeActiveCtas(store.activeCtas);
  writeAuditLog(store.auditLog);
  writeAttendance(store.attendance);
  writeCtaHistory(store.ctaHistory);
};

let cache = null;

const getStore = () => {
  if (useLegacyStore()) {
    const legacy = readLegacyStore();
    if (legacy) {
      migrateFromLegacy(legacy);
      cache = readAll();
      return cache;
    }
  }
  if (cache) return cache;
  cache = readAll();
  return cache;
};

const updateStore = (updater) => {
  const store = getStore();
  const next = updater(store) || store;
  writeAll(next);
  cache = next;
  return next;
};

const resetStoreCache = () => {
  cache = null;
};

module.exports = {
  getStore,
  updateStore,
  resetStoreCache,
  formatManilaDateFile
};
