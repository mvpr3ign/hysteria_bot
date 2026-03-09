/**
 * Unit tests for store.js (new structure: data/ctas, data/users, logs/audit).
 * Uses a temp directory so production data is not touched.
 * Run: npm test
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

const testRoot = path.join(os.tmpdir(), `cta-store-test-${Date.now()}`);
process.env.STORE_ROOT = testRoot;

const { getStore, updateStore, resetStoreCache, formatManilaDateFile } = require("../store");

describe("store", () => {
  afterEach(() => {
    resetStoreCache();
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testRoot)) {
        fs.rmSync(testRoot, { recursive: true, force: true });
      }
    } catch (e) {
      // ignore cleanup errors
    }
  });

  describe("formatManilaDateFile", () => {
    it("returns YYYY-MM-DD for a given timestamp", () => {
      const d = new Date("2026-03-09T08:00:00.000Z");
      const result = formatManilaDateFile(d);
      assert.strictEqual(result.length, 10);
      assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
      assert.strictEqual(result, "2026-03-09");
    });

    it("accepts number timestamp", () => {
      const result = formatManilaDateFile(1741564800000);
      assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("getStore (new structure, no legacy)", () => {
    it("creates data dirs and returns default store when no files exist", () => {
      const store = getStore();
      assert.ok(fs.existsSync(path.join(testRoot, "data")));
      assert.ok(fs.existsSync(path.join(testRoot, "data", "ctas")));
      assert.ok(fs.existsSync(path.join(testRoot, "data", "users")));
      assert.ok(fs.existsSync(path.join(testRoot, "logs")));
      assert.deepStrictEqual(Object.keys(store), ["eventPoints", "activeCtas", "ctaHistory", "attendance", "auditLog"]);
      assert.deepStrictEqual(store.ctaHistory, []);
      assert.deepStrictEqual(store.activeCtas, {});
      assert.deepStrictEqual(store.attendance, {});
      assert.deepStrictEqual(store.auditLog, []);
      assert.ok(store.eventPoints.CW1);
    });

    it("returns cached store on second getStore()", () => {
      const first = getStore();
      first.auditLog.push({ action: "test" });
      const second = getStore();
      assert.strictEqual(second.auditLog.length, 1);
    });

    it("after resetStoreCache, getStore reads from disk again", () => {
      updateStore((s) => {
        s.auditLog.push({ action: "one" });
        return s;
      });
      resetStoreCache();
      const store = getStore();
      assert.strictEqual(store.auditLog.length, 1);
      assert.strictEqual(store.auditLog[0].action, "one");
    });
  });

  describe("updateStore", () => {
    it("persists eventPoints", () => {
      updateStore((s) => {
        s.eventPoints.NEWEVENT = 5;
        return s;
      });
      resetStoreCache();
      const store = getStore();
      assert.strictEqual(store.eventPoints.NEWEVENT, 5);
    });

    it("persists activeCtas", () => {
      updateStore((s) => {
        s.activeCtas["123"] = { eventType: "CW1", createdAt: Date.now(), expiresAt: Date.now() + 60000 };
        return s;
      });
      resetStoreCache();
      const store = getStore();
      assert.strictEqual(store.activeCtas["123"].eventType, "CW1");
    });

    it("persists attendance (one user file per userId)", () => {
      updateStore((s) => {
        s.attendance["user1"] = { totalPoints: 10, history: [], profile: { ign: "Test" } };
        return s;
      });
      resetStoreCache();
      const store = getStore();
      assert.strictEqual(store.attendance["user1"].totalPoints, 10);
      assert.strictEqual(store.attendance["user1"].profile.ign, "Test");
      assert.ok(fs.existsSync(path.join(testRoot, "data", "users", "user1.json")));
    });

    it("persists auditLog", () => {
      updateStore((s) => {
        s.auditLog.push({ action: "test_action", performedBy: "u1", timestamp: "now" });
        return s;
      });
      resetStoreCache();
      const store = getStore();
      assert.strictEqual(store.auditLog.length, 1);
      assert.strictEqual(store.auditLog[0].action, "test_action");
    });

    it("persists ctaHistory into data/ctas/YYYY-MM-DD.json", () => {
      const now = new Date("2026-03-09T10:00:00.000Z");
      updateStore((s) => {
        s.ctaHistory.push({
          eventType: "CW1",
          createdAt: now.getTime(),
          channelId: "ch1",
          attendees: []
        });
        return s;
      });
      resetStoreCache();
      const store = getStore();
      assert.strictEqual(store.ctaHistory.length, 1);
      assert.strictEqual(store.ctaHistory[0].eventType, "CW1");
      const ctasFile = path.join(testRoot, "data", "ctas", "2026-03-09.json");
      assert.ok(fs.existsSync(ctasFile));
      const raw = JSON.parse(fs.readFileSync(ctasFile, "utf-8"));
      assert.strictEqual(raw.length, 1);
      assert.strictEqual(raw[0].eventType, "CW1");
    });

    it("updater returning undefined keeps store unchanged but still writes", () => {
      updateStore((s) => {
        s.eventPoints.CW1 = 99;
        return s;
      });
      updateStore(() => {});
      resetStoreCache();
      const store = getStore();
      assert.strictEqual(store.eventPoints.CW1, 99);
    });
  });

  describe("ctaHistory multiple days", () => {
    it("writes separate files per Manila date and merges on read", () => {
      updateStore((s) => {
        s.ctaHistory = [
          { eventType: "A", createdAt: new Date("2026-03-08T12:00:00Z").getTime(), channelId: "1", attendees: [] },
          { eventType: "B", createdAt: new Date("2026-03-09T12:00:00Z").getTime(), channelId: "2", attendees: [] },
          { eventType: "C", createdAt: new Date("2026-03-08T14:00:00Z").getTime(), channelId: "3", attendees: [] }
        ];
        return s;
      });
      resetStoreCache();
      const store = getStore();
      assert.strictEqual(store.ctaHistory.length, 3);
      assert.strictEqual(store.ctaHistory[0].eventType, "A");
      assert.strictEqual(store.ctaHistory[1].eventType, "C");
      assert.strictEqual(store.ctaHistory[2].eventType, "B");
      assert.ok(fs.existsSync(path.join(testRoot, "data", "ctas", "2026-03-08.json")));
      assert.ok(fs.existsSync(path.join(testRoot, "data", "ctas", "2026-03-09.json")));
    });
  });

  describe("migration from legacy store.json", () => {
    beforeEach(() => {
      if (!fs.existsSync(testRoot)) {
        fs.mkdirSync(testRoot, { recursive: true });
      }
      const legacy = {
        eventPoints: { CW1: 10, CUSTOM: 3 },
        activeCtas: {},
        ctaHistory: [
          { eventType: "CW1", createdAt: new Date("2026-03-09T10:00:00Z").getTime(), channelId: "ch1", attendees: [] }
        ],
        attendance: {
          userA: { totalPoints: 50, history: [], profile: { ign: "PlayerA" } }
        },
        auditLog: [{ action: "migrated", performedBy: "system" }]
      };
      fs.writeFileSync(path.join(testRoot, "store.json"), JSON.stringify(legacy, null, 2));
    });

    it("migrates legacy store.json to data/ and logs/, renames store.json to .bak", () => {
      const store = getStore();
      assert.ok(fs.existsSync(path.join(testRoot, "data")));
      assert.ok(fs.existsSync(path.join(testRoot, "data", "ctas")));
      assert.ok(fs.existsSync(path.join(testRoot, "data", "users")));
      assert.ok(fs.existsSync(path.join(testRoot, "logs")));
      assert.ok(!fs.existsSync(path.join(testRoot, "store.json")));
      assert.ok(fs.existsSync(path.join(testRoot, "store.json.bak")));
      assert.strictEqual(store.eventPoints.CW1, 10);
      assert.strictEqual(store.eventPoints.CUSTOM, 3);
      assert.strictEqual(store.ctaHistory.length, 1);
      assert.strictEqual(store.ctaHistory[0].eventType, "CW1");
      assert.strictEqual(store.attendance["userA"].profile.ign, "PlayerA");
      assert.strictEqual(store.auditLog.length, 1);
      assert.strictEqual(store.auditLog[0].action, "migrated");
    });
  });
});
