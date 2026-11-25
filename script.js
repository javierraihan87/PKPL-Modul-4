
const USERS_KEY = "runtrack_users";
const SESSION_KEY = "runtrack_session";
const RUNS_KEY = "runtrack_runs";

const $ = id => document.getElementById(id);

const today = () => new Date().toISOString().slice(0, 10);

function users() {
  return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
}

function saveUsers(v) {
  localStorage.setItem(USERS_KEY, JSON.stringify(v));
}

function session() {
  return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
}

function setMsg(id, text, error = false) {
  $(id).textContent = text;
  $(id).style.color = error ? "#dc2626" : "#15803d";
}

function runs() {
  return JSON.parse(localStorage.getItem(RUNS_KEY) || "[]");
}

function saveRuns(v) {
  localStorage.setItem(RUNS_KEY, JSON.stringify(v));
}

function currentUser() {
  const s = session();
  return s ? users().find(u => u.email === s.email) : null;
}

function pace(distance, duration) {
  return distance > 0 && duration > 0
    ? duration / distance
    : null;
}

function paceText(p) {
  if (p === null) return "-";

  let m = Math.floor(p);
  let s = Math.round((p - m) * 60);

  if (s === 60) {
    m++;
    s = 0;
  }

  return `${m}:${String(s).padStart(2, "0")}`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function showAuth(tab) {
  document.querySelectorAll(".tab").forEach(x => {
    x.classList.toggle("active", x.dataset.auth === tab);
  });

  ["login", "register", "forgot"].forEach(x => {
    $(`${x}Form`).classList.toggle("hidden", x !== tab);
  });
}

document.querySelectorAll(".tab").forEach(x => {
  x.onclick = () => showAuth(x.dataset.auth);
});

// REGISTER
$("registerForm").onsubmit = e => {
  e.preventDefault();

  let name = $("regName").value.trim();
  let email = $("regEmail").value.trim().toLowerCase();
  let password = $("regPassword").value;

  if (password.length < 8) {
    return setMsg(
      "registerMsg",
      "Password minimal 8 karakter.",
      true
    );
  }

  let u = users();

  if (u.some(x => x.email === email)) {
    return setMsg(
      "registerMsg",
      "Email sudah terdaftar.",
      true
    );
  }

  u.push({ name, email, password });
  saveUsers(u);

  setMsg(
    "registerMsg",
    "Akun berhasil dibuat. Silakan login."
  );

  $("registerForm").reset();

  setTimeout(() => showAuth("login"), 700);
};

// LOGIN
$("loginForm").onsubmit = e => {
  e.preventDefault();

  let email = $("loginEmail").value.trim().toLowerCase();
  let password = $("loginPassword").value;
  let u = users();

  let found = u.find(
    x => x.email === email && x.password === password
  );

  if (!found) {
    return setMsg(
      "loginMsg",
      "Email atau password salah.",
      true
    );
  }

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ email })
  );

  loadApp();
};

// FORGOT PASSWORD
$("forgotForm").onsubmit = e => {
  e.preventDefault();

  let email = $("forgotEmail").value.trim().toLowerCase();

  if (!users().some(x => x.email === email)) {
    return setMsg(
      "forgotMsg",
      "Email tidak ditemukan.",
      true
    );
  }

  setMsg(
    "forgotMsg",
    "Link reset password simulasi telah dikirim ke email."
  );
};

// LOGOUT
$("logoutBtn").onclick = () => {
  localStorage.removeItem(SESSION_KEY);
  location.reload();
};

// MODAL AKTIVITAS
$("openRunBtn").onclick = () => openModal();
$("closeModal").onclick = () => closeModal();

$("runDistance").oninput =
$("runDuration").oninput = () => updatePace();

function updatePace() {
  let d = Number($("runDistance").value);
  let t = Number($("runDuration").value);

  $("pacePreview").textContent = paceText(pace(d, t));
}

function openModal(id = null) {
  $("runModal").classList.remove("hidden");
  $("runMsg").textContent = "";

  $("runForm").reset();
  $("runDate").value = today();
  $("runId").value = "";

  $("modalTitle").textContent = id
    ? "Edit Aktivitas"
    : "Catat Lari";

  if (id) {
    let r = runs().find(x => x.id === id);

    if (!r || r.email !== currentUser()?.email) return;

    $("runId").value = r.id;
    $("runDate").value = r.date;
    $("runDistance").value = r.distance;
    $("runDuration").value = r.duration;
    $("runNote").value = r.note || "";

    // RUNNING COMPANION:
    // Muat nama teman saat aktivitas diedit.
    $("runCompanions").value = Array.isArray(r.companions)
      ? r.companions.join(", ")
      : (r.companions || "");

    updatePace();
  }
}

function closeModal() {
  $("runModal").classList.add("hidden");
}

// SIMPAN / EDIT AKTIVITAS
$("runForm").onsubmit = e => {
  e.preventDefault();

  let d = Number($("runDistance").value);
  let t = Number($("runDuration").value);

  if (d <= 0 || t <= 0) {
    return setMsg(
      "runMsg",
      "Jarak dan durasi harus lebih dari 0.",
      true
    );
  }

  let me = currentUser();

  if (!me) {
    return setMsg(
      "runMsg",
      "Silakan login kembali.",
      true
    );
  }

  // RUNNING COMPANION:
  // Pisahkan nama teman berdasarkan koma,
  // hilangkan spasi berlebih dan nama duplikat.
  let companions = $("runCompanions").value
    .split(",")
    .map(name => name.trim())
    .filter(name => name !== "");

  companions = [
    ...new Map(
      companions.map(name => [name.toLowerCase(), name])
    ).values()
  ];

  let all = runs();
  let id = $("runId").value;

  if (id) {
    let i = all.findIndex(
      x => x.id === id && x.email === me.email
    );

    if (i < 0) {
      return setMsg(
        "runMsg",
        "Aktivitas tidak ditemukan.",
        true
      );
    }

    all[i] = {
      ...all[i],
      date: $("runDate").value,
      distance: d,
      duration: t,
      note: $("runNote").value.trim(),
      companions
    };
  } else {
    all.push({
      id: crypto.randomUUID(),
      email: me.email,
      date: $("runDate").value,
      distance: d,
      duration: t,
      note: $("runNote").value.trim(),
      companions,
      createdAt: new Date().toISOString()
    });
  }

  saveRuns(all);
  closeModal();
  render();
};

// HAPUS AKTIVITAS
function deleteRun(id) {
  if (!confirm("Hapus aktivitas ini?")) return;

  let me = currentUser();

  if (!me) return;

  saveRuns(
    runs().filter(
      r => !(r.id === id && r.email === me.email)
    )
  );

  render();
}

// TAMPILKAN DASHBOARD DAN RIWAYAT
function render() {
  let me = currentUser();

  if (!me) return;

  let mine = runs()
    .filter(r => r.email === me.email)
    .sort((a, b) => b.date.localeCompare(a.date));

  let q = $("searchInput").value.trim().toLowerCase();
  let date = $("dateFilter").value;
  let df = $("distanceFilter").value;

  // Pencarian catatan, tanggal, dan nama teman.
  let filtered = mine.filter(r => {
    let companionNames = Array.isArray(r.companions)
      ? r.companions.join(", ")
      : (r.companions || "");

    let matchesSearch =
      !q ||
      (r.note || "").toLowerCase().includes(q) ||
      companionNames.toLowerCase().includes(q) ||
      r.date.includes(q);

    let matchesDate = !date || r.date === date;

    let matchesDistance =
      df === "all" ||
      (df === "short" && r.distance < 5) ||
      (
        df === "medium" &&
        r.distance >= 5 &&
        r.distance <= 10
      ) ||
      (df === "long" && r.distance > 10);

    return matchesSearch && matchesDate && matchesDistance;
  });

  // STATISTIK
  $("totalRuns").textContent = mine.length;

  $("totalDistance").textContent =
    mine.reduce((s, r) => s + r.distance, 0).toFixed(2) +
    " km";

  $("totalDuration").textContent =
    mine.reduce((s, r) => s + r.duration, 0) +
    " mnt";

  let totalDistance = mine.reduce(
    (s, r) => s + r.distance,
    0
  );

  let avg = totalDistance > 0
    ? mine.reduce((s, r) => s + r.duration, 0) / totalDistance
    : null;

  $("avgPace").textContent = paceText(avg) + " /km";

  // RIWAYAT AKTIVITAS
  $("runList").innerHTML = filtered.length
    ? filtered.map(r => {
        let companionNames = Array.isArray(r.companions)
          ? r.companions.join(", ")
          : (r.companions || "");

        return `
          <div class="run-item">
            <div>
              <div class="label">Tanggal</div>
              <div class="value">${escapeHtml(r.date)}</div>
            </div>

            <div>
              <div class="label">Jarak</div>
              <div class="value">${Number(r.distance).toFixed(2)} km</div>
            </div>

            <div>
              <div class="label">Durasi</div>
              <div class="value">${escapeHtml(String(r.duration))} mnt</div>
            </div>

            <div>
              <div class="label">Pace</div>
              <div class="value">${paceText(pace(r.distance, r.duration))}</div>
            </div>

            <div>
              <div class="label">Catatan</div>
              <div class="value">${escapeHtml(r.note || "-")}</div>
            </div>

            <div>
              <div class="label">Teman Lari</div>
              <div class="value">${escapeHtml(companionNames || "-")}</div>
            </div>

            <div class="actions">
              <button
                class="small"
                onclick="openModal('${r.id}')"
              >Edit</button>

              <button
                class="small danger"
                onclick="deleteRun('${r.id}')"
              >Hapus</button>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="empty">Belum ada aktivitas yang sesuai filter.</div>`;
}

// EVENT PENCARIAN DAN FILTER
["searchInput", "dateFilter", "distanceFilter"].forEach(id => {
  $(id).addEventListener("input", render);
});

// MUAT APLIKASI
function loadApp() {
  let me = currentUser();

  if (!me) {
    $("authView").classList.remove("hidden");
    $("appView").classList.add("hidden");
    return;
  }

  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");

  $("runnerName").textContent = me.name;
  $("welcomeUser").textContent = me.email;

  render();
}

loadApp();
