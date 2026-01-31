const fs = require("fs");
const path = require("path");

const STORE_PATH = path.join(__dirname, "store.json");

const defaultStore = {
  eventPoints: {
    CW1: 2,
    CW2: 3,
    CW3: 4,
    EPB: 3,
    PBS: 1
  },
  activeCtas: {},
  ctaHistory: [],
  attendance: {},
  auditLog: []
};

const readStore = () => {
  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(defaultStore, null, 2));
    return { ...defaultStore };
  }

  const raw = fs.readFileSync(STORE_PATH, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return { ...defaultStore, ...parsed };
  } catch (error) {
    return { ...defaultStore };
  }
};

const writeStore = (store) => {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
};

const getStore = () => readStore();

const updateStore = (updater) => {
  const store = readStore();
  const next = updater(store) || store;
  writeStore(next);
  return next;
};

module.exports = {
  getStore,
  updateStore
};
