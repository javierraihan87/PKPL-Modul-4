// runtrack.test.js — Unit test runForm.onsubmit pada script.js ASLI (TC-01 s/d TC-05)
// node:test + node:assert. script.js dimuat ke node:vm; DOM/localStorage diganti test double.
const { describe, it, mock } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const SCRIPT_PATH = path.join(__dirname, "script.js");
const SCRIPT = new vm.Script(fs.readFileSync(SCRIPT_PATH, "utf8"), { filename: SCRIPT_PATH });

const BUDI = { name: "Budi", email: "budi@mail.com", password: "rahasia123" };

// ---- Fake DOM element (sekadar menampung value/textContent/classList) ----
function makeEl() {
  const cls = new Set();
  return {
    value: "", textContent: "", innerHTML: "", style: {},
    onsubmit: null, onclick: null, oninput: null,
    classList: {
      add: c => cls.add(c), remove: c => cls.delete(c),
      toggle: (c, f) => ((f === undefined ? !cls.has(c) : f) ? cls.add(c) : cls.delete(c)),
      contains: c => cls.has(c),
    },
    reset() {}, addEventListener() {},
  };
}

// ---- FAKE: localStorage berbasis Map ----
class FakeStorage {
  #d = new Map();
  getItem(k) { return this.#d.has(k) ? this.#d.get(k) : null; }
  setItem(k, v) { this.#d.set(k, String(v)); }
  removeItem(k) { this.#d.delete(k); }
}

// Memuat script.js dan memasang test double.
function createApp({ session = BUDI.email, existingRuns = [], fields = {} } = {}) {
  const store = new FakeStorage();
  store.setItem("runtrack_users", JSON.stringify([BUDI]));
  if (session) store.setItem("runtrack_session", JSON.stringify({ email: session }));
  if (existingRuns.length) store.setItem("runtrack_runs", JSON.stringify(existingRuns));

  const els = {};
  const el = id => (els[id] ??= makeEl());
  Object.entries({
    runDistance: "5", runDuration: "30", runDate: "2026-11-18",
    runNote: "", runCompanions: "", runId: "", distanceFilter: "all", ...fields,
  }).forEach(([k, v]) => (el(k).value = v));

  // STUB: crypto.randomUUID() selalu mengembalikan "run-1" (hanya memberi jawaban tetap)
  const crypto = { randomUUID: mock.fn(() => "run-1") };

  // STUB: Date tanpa argumen selalu menghasilkan waktu tetap (agar createdAt deterministik)
  class FixedDate extends Date {
    constructor(...args) { args.length ? super(...args) : super("2026-11-18T07:00:00.000Z"); }
  }

  const ctx = vm.createContext({
    Date: FixedDate,
    document: { getElementById: el, querySelectorAll: () => [] },
    localStorage: store, crypto,
    confirm: () => true, setTimeout: () => 0, location: { reload() {} },
  });
  SCRIPT.runInContext(ctx);       // jalankan script.js asli

  // MOCK: fungsi ber-efek-samping diganti mock murni (tanpa perilaku asli) agar
  // pemanggilannya (jumlah & argumen) dapat diverifikasi. Tidak menulis ke localStorage.
  ctx.saveRuns = mock.fn();
  ctx.closeModal = mock.fn();
  ctx.render = mock.fn();
  return { ctx, el, store, crypto, saveRuns: ctx.saveRuns, closeModal: ctx.closeModal, render: ctx.render };
}

// Hasil dari konteks vm dinormalkan agar deepEqual tidak terkendala beda realm array
const plain = x => JSON.parse(JSON.stringify(x));
const makeEvent = () => ({ preventDefault: mock.fn() });
const savedRuns = a => JSON.parse(a.store.getItem("runtrack_runs") || "null");

describe("F4 runForm.onsubmit", () => {
  it("TC-01: jarak 0 ditolak", () => {
    // Arrange
    const a = createApp({ fields: { runDistance: "0" } });
    const e = makeEvent();

    // Act
    a.el("runForm").onsubmit(e);

    // Assert
    assert.equal(e.preventDefault.mock.callCount(), 1);
    assert.equal(a.el("runMsg").textContent, "Jarak dan durasi harus lebih dari 0.");
    assert.equal(a.el("runMsg").style.color, "#dc2626");
    assert.equal(a.saveRuns.mock.callCount(), 0);        // data tidak disimpan
    assert.equal(savedRuns(a), null);
  });

  it("TC-02: input valid tetapi belum login ditolak", () => {
    // Arrange
    const a = createApp({ session: null });

    // Act
    a.el("runForm").onsubmit(makeEvent());

    // Assert
    assert.equal(a.el("runMsg").textContent, "Silakan login kembali.");
    assert.equal(a.saveRuns.mock.callCount(), 0);
    assert.equal(savedRuns(a), null);
  });

  it("TC-03: aktivitas baru + teman lari (trim, kosong, duplikat dibuang)", () => {
    // Arrange
    const a = createApp({ fields: { runNote: "  Pagi hari ", runCompanions: "Budi,  Ani , ,budi," } });

    // Act
    a.el("runForm").onsubmit(makeEvent());

    // Assert
    assert.equal(a.crypto.randomUUID.mock.callCount(), 1);
    assert.equal(a.saveRuns.mock.callCount(), 1);       // MOCK: dipanggil tepat sekali
    const arg = plain(a.saveRuns.mock.calls[0].arguments[0]);  // ... dengan 1 aktivitas
    assert.equal(arg.length, 1);
    assert.equal(arg[0].id, "run-1");                   // STUB randomUUID
    assert.equal(arg[0].email, BUDI.email);
    assert.equal(arg[0].distance, 5);
    assert.equal(arg[0].duration, 30);
    assert.equal(arg[0].note, "Pagi hari");
    assert.deepEqual(arg[0].companions.map(n => n.toLowerCase()), ["budi", "ani"]);
    assert.equal(arg[0].createdAt, "2026-11-18T07:00:00.000Z");
    assert.equal(a.closeModal.mock.callCount(), 1);
    assert.equal(a.render.mock.callCount(), 1);
  });

  it("TC-04: edit aktivitas milik sendiri memperbarui data", () => {
    // Arrange
    const old = { id: "run-9", email: BUDI.email, date: "2026-11-01", distance: 5,
                  duration: 30, note: "lama", companions: [], createdAt: "2026-11-01T00:00:00.000Z" };
    const a = createApp({
      existingRuns: [old],
      fields: { runId: "run-9", runDistance: "8", runDuration: "44", runCompanions: "Citra" },
    });

    // Act
    a.el("runForm").onsubmit(makeEvent());

    // Assert
    assert.equal(a.crypto.randomUUID.mock.callCount(), 0);     // tidak membuat id baru
    assert.equal(a.saveRuns.mock.callCount(), 1);
    const arg = plain(a.saveRuns.mock.calls[0].arguments[0]);
    assert.equal(arg.length, 1);
    assert.equal(arg[0].id, "run-9");
    assert.equal(arg[0].distance, 8);
    assert.equal(arg[0].duration, 44);
    assert.deepEqual(arg[0].companions, ["Citra"]);
    assert.equal(arg[0].createdAt, old.createdAt);             // createdAt tetap
    assert.equal(a.render.mock.callCount(), 1);
  });

  it("TC-05: edit aktivitas milik user lain / id tidak ada ditolak", () => {
    // Arrange
    const other = { id: "run-9", email: "lain@mail.com", date: "2026-11-01", distance: 5, duration: 30 };
    const a = createApp({ existingRuns: [other], fields: { runId: "run-9", runDistance: "99" } });

    // Act
    a.el("runForm").onsubmit(makeEvent());

    // Assert
    assert.equal(a.el("runMsg").textContent, "Aktivitas tidak ditemukan.");
    assert.equal(a.saveRuns.mock.callCount(), 0);              // data tidak berubah
    assert.deepEqual(savedRuns(a), [other]);
  });
});
