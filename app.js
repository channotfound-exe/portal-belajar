/* Portal Belajar Sains Data - Pastel Kalem PWA + Pyodide v0.26.4 */
const STORAGE_KEY = "portal_sains_data_static_v1";
const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";

/* Warna pastel unik & emoji per mata kuliah (tanpa mengubah data/) */
const COURSE_THEMES = {
  statistika: { color: "#B7D3C0", emoji: "📊" },
  pengantar_sains_data: { color: "#D5C8F0", emoji: "🧭" },
  kalkulus_diferensial: { color: "#CFE3F5", emoji: "∫" },
  dasar_infrastruktur_ti: { color: "#FFD9C7", emoji: "🖥️" },
  pengantar_sistem_informasi: { color: "#F6DFB8", emoji: "🏢" },
  bahasa_indonesia: { color: "#F5C6D6", emoji: "✍️" },
  alprog: { color: "#BCE3D5", emoji: "🐍" },
  analitik_big_data: { color: "#C6DDF5", emoji: "🌐" },
  basis_data_nosql: { color: "#DFD0F5", emoji: "🗄️" },
  data_mining: { color: "#F9D6C1", emoji: "⛏️" },
  pengantar_kecerdasan_artifisial: { color: "#D2E8C8", emoji: "🤖" },
  pengantar_statistika_matematis: { color: "#E5CEF2", emoji: "📐" },
  pancasila: { color: "#F7D2CC", emoji: "🇮🇩" },
};

const ACHIEVEMENTS = [
  { id: "first_step", icon: "🌱", title: "Langkah Pertama", desc: "Jawab minimal 1 soal latihan" },
  { id: "streak_10", icon: "🎯", title: "10 Soal Benar Beruntun", desc: "Jawab 10 soal benar berturut-turut" },
  { id: "bab_done", icon: "📖", title: "Bab Selesai", desc: "Tandai minimal 1 bab sudah paham" },
  { id: "lab_runner", icon: "💻", title: "Penjelajah Kode", desc: "Selesaikan minimal 1 lab praktek" },
  { id: "stage_clear", icon: "🏆", title: "Penakluk Satu Tahap", desc: "Selesaikan 50 soal dalam 1 tahap" },
  { id: "daily_3", icon: "🔥", title: "Streak 3 Hari", desc: "Belajar 3 hari berturut-turut" },
];

const state = {
  index: [],
  coursesCache: {},
  activeCourse: null,
  activeSection: "beranda", // beranda | belajar | latihan | statistik | pengaturan
  activeBelajarTab: "modul",
  activeLatihanTab: "quiz",
  activeSemFilter: "all",
  activeChapterIdx: 0,
  activeStage: "1",
  filteredQuestions: [],
  activeQIdx: 0,
  quizMode: "instant",
  examActive: false,
  examSubmitted: false,
  examSecondsLeft: 3600,
  examTimerHandle: null,
  fcList: [],
  fcIdx: 0,
  activeLabIdx: 0,
  sandboxMode: false,
  progress: loadProgress(),
};

let pyodideInstance = null;
let pyodideInitPromise = null;
const loadedPyodidePackages = new Set();
let deferredInstallPrompt = null;

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function getCourseProg(courseId) {
  if (!state.progress[courseId]) {
    state.progress[courseId] = {
      answers: {},
      flagged: {},
      mastered: {},
      notes: {},
      labPassed: {},
      labCode: {},
    };
  }
  return state.progress[courseId];
}

function getGamify() {
  if (!state.progress.__gamify) {
    state.progress.__gamify = {
      xp: 0,
      awardedKeys: {},
      correctRun: 0,
      maxCorrectRun: 0,
      dailyStreak: 1,
      lastDate: "",
      badges: {},
      stageCelebrated: {},
    };
  }
  return state.progress.__gamify;
}

function getSavedReports() {
  if (!Array.isArray(state.progress.__savedReports)) {
    state.progress.__savedReports = [];
  }
  return state.progress.__savedReports;
}

function getLastCourseId() {
  return state.progress.__lastCourseId || null;
}

function setLastCourseId(cid) {
  state.progress.__lastCourseId = cid;
  saveProgress();
}

function getCourseTheme(cid) {
  return COURSE_THEMES[cid] || { color: "#B7D3C0", emoji: "📘" };
}

/* Theme System (Default follows system, saved in localStorage) */
function getThemePref() {
  return localStorage.getItem("portal_theme_pref") || "system";
}

function applyTheme(pref) {
  localStorage.setItem("portal_theme_pref", pref);
  const sysDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = pref === "dark" || (pref === "system" && sysDark);
  document.body.classList.toggle("theme-dark", isDark);

  const metaTheme = document.getElementById("meta-theme-color");
  if (metaTheme) metaTheme.setAttribute("content", isDark ? "#1F1D2E" : "#FAF6EF");

  const iconEl = document.getElementById("theme-toggle-icon");
  const lblEl = document.getElementById("theme-toggle-label");
  if (iconEl) iconEl.textContent = isDark ? "☀️" : "🌙";
  if (lblEl) lblEl.textContent = isDark ? "Terang" : "Gelap";

  document.querySelectorAll("#theme-choices button").forEach((b) => {
    b.classList.toggle("selected", b.dataset.themePref === pref);
  });
  const note = document.getElementById("theme-current-note");
  if (note) {
    const label = pref === "system" ? `Mengikuti sistem (${isDark ? "Pastel Gelap" : "Pastel Terang"})` : pref === "dark" ? "Pastel Gelap" : "Pastel Terang";
    note.textContent = `Mode aktif saat ini: ${label}`;
  }
}

/* Gamification Logic */
function touchDailyStreak() {
  const g = getGamify();
  const today = new Date().toISOString().slice(0, 10);
  if (!g.lastDate) {
    g.dailyStreak = 1;
    g.lastDate = today;
  } else if (g.lastDate !== today) {
    const prev = new Date(g.lastDate);
    const cur = new Date(today);
    const diffDays = Math.round((cur - prev) / 86400000);
    g.dailyStreak = diffDays === 1 ? g.dailyStreak + 1 : 1;
    g.lastDate = today;
  }
  if (g.dailyStreak >= 3) g.badges.daily_3 = true;
  saveProgress();
}

function awardXp(uniqueKey, amount) {
  const g = getGamify();
  if (g.awardedKeys[uniqueKey]) return;
  g.awardedKeys[uniqueKey] = true;
  g.xp += amount;
  saveProgress();
}

function refreshGamifyUI() {
  const g = getGamify();
  // Check overall badges safely
  let anyMastered = false;
  let anyLab = false;
  let anyAns = false;
  state.index.forEach((item) => {
    const p = state.progress[item.id];
    if (!p) return;
    if (Object.values(p.mastered || {}).some(Boolean)) anyMastered = true;
    if (Object.values(p.labPassed || {}).some(Boolean)) anyLab = true;
    if (Object.keys(p.answers || {}).length > 0) anyAns = true;
  });
  if (anyAns) g.badges.first_step = true;
  if (anyMastered) g.badges.bab_done = true;
  if (anyLab) g.badges.lab_runner = true;
  if (g.maxCorrectRun >= 10) g.badges.streak_10 = true;

  const badgeCount = ACHIEVEMENTS.filter((a) => g.badges[a.id]).length;
  ["side-streak", "hero-streak", "stat-streak"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = id === "side-streak" ? `${g.dailyStreak} Hari` : g.dailyStreak;
  });
  ["side-xp", "hero-xp", "stat-xp"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = id === "side-xp" ? `${g.xp} XP` : g.xp;
  });
  const sb = document.getElementById("side-badges");
  const hb = document.getElementById("hero-badges");
  if (sb) sb.textContent = `${badgeCount} / ${ACHIEVEMENTS.length}`;
  if (hb) hb.textContent = `${badgeCount}/${ACHIEVEMENTS.length}`;

  const achGrid = document.getElementById("achievements-grid");
  if (achGrid) {
    achGrid.innerHTML = ACHIEVEMENTS.map((a) => `
      <div class="ach-card ${g.badges[a.id] ? "unlocked" : ""}">
        <div class="ach-ico">${a.icon}</div>
        <div>
          <div class="ach-title">${escHtml(a.title)}</div>
          <div class="ach-desc">${escHtml(a.desc)}</div>
        </div>
      </div>`).join("");
  }
}

function launchSubtleConfetti() {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.getElementById("confetti-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const colors = ["#B7D3C0", "#D5C8F0", "#FFD9C7", "#CFE3F5", "#F5C6D6"];
  const pieces = Array.from({ length: 65 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 140,
    w: 7 + Math.random() * 6,
    h: 5 + Math.random() * 6,
    vy: 2.2 + Math.random() * 3.2,
    vx: (Math.random() - 0.5) * 2.4,
    rot: Math.random() * 360,
    vr: (Math.random() - 0.5) * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));
  let frame = 0;
  function tick() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (frame < 110) requestAnimationFrame(tick);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(tick);
}

/* PWA Controls */
function initPwaControls() {
  const offlineEl = document.getElementById("offline-indicator");
  const installBtn = document.getElementById("btn-install-pwa");
  const installBtnSet = document.getElementById("btn-install-pwa-settings");

  const syncOnlineStatus = () => {
    if (offlineEl) offlineEl.style.display = navigator.onLine ? "none" : "inline-flex";
    const netEl = document.getElementById("settings-net-status");
    if (netEl) netEl.textContent = navigator.onLine ? "Online" : "Offline (Menggunakan Cache Lokal)";
  };
  syncOnlineStatus();
  window.addEventListener("online", syncOnlineStatus);
  window.addEventListener("offline", syncOnlineStatus);

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (installBtn) installBtn.style.display = "inline-flex";
    if (installBtnSet) installBtnSet.style.display = "inline-flex";
  });

  const handleInstall = async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (installBtn) installBtn.style.display = "none";
    if (installBtnSet) installBtnSet.style.display = "none";
  };

  if (installBtn) installBtn.addEventListener("click", handleInstall);
  if (installBtnSet) installBtnSet.addEventListener("click", handleInstall);

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (installBtn) installBtn.style.display = "none";
    if (installBtnSet) installBtnSet.style.display = "none";
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      const swEl = document.getElementById("settings-sw-status");
      if (swEl) swEl.textContent = reg.active ? "Aktif (portal-v4 siap offline)" : "Terdaftar";
    });
  }
}

/* Safe Markdown + LaTeX renderer */
function protectCodeAndMath(rawText) {
  const codeBlocks = [];
  const mathBlocks = [];
  let text = String(rawText ?? "");
  text = text.replace(/```[\s\S]*?```/g, (m) => {
    codeBlocks.push(m);
    return `@@CODEBLOCK_${codeBlocks.length - 1}@@`;
  });
  text = text.replace(/`[^`\n]+?`/g, (m) => {
    codeBlocks.push(m);
    return `@@CODEBLOCK_${codeBlocks.length - 1}@@`;
  });
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, m) => {
    mathBlocks.push(`$$${m}$$`);
    return `@@MATHBLOCK_${mathBlocks.length - 1}@@`;
  });
  text = text.replace(/\$([^\n$]+?)\$/g, (_, m) => {
    mathBlocks.push(`$${m}$`);
    return `@@MATHBLOCK_${mathBlocks.length - 1}@@`;
  });
  text = text.replace(/@@CODEBLOCK_(\d+)@@/g, (_, idx) => codeBlocks[Number(idx)]);
  return { text, mathBlocks };
}

function restoreMath(html, mathBlocks) {
  return html.replace(/@@MATHBLOCK_(\d+)@@/g, (_, idx) => mathBlocks[Number(idx)]);
}

function renderMd(mdText) {
  if (!mdText) return "";
  const { text, mathBlocks } = protectCodeAndMath(mdText);
  const html = window.marked ? window.marked.parse(text) : text.replace(/\n/g, "<br>");
  return restoreMath(html, mathBlocks);
}

function renderInlineMd(mdText) {
  if (!mdText) return "";
  const { text, mathBlocks } = protectCodeAndMath(mdText);
  const html = window.marked && window.marked.parseInline
    ? window.marked.parseInline(text)
    : (window.marked ? window.marked.parse(text) : text);
  return restoreMath(html, mathBlocks);
}

function applyMath(el) {
  if (window.renderMathInElement && el) {
    window.renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
      throwOnError: false,
    });
  }
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function prioClass(prio) {
  if (!prio) return "prio-sedang";
  const p = prio.toLowerCase();
  if (p.includes("sangat")) return "prio-sangat-tinggi";
  if (p.includes("tinggi")) return "prio-tinggi";
  return "prio-sedang";
}

function getStageQuestions(course, stageVal) {
  if (!course) return [];
  const s1 = (course.questions_stage_1 || []).map((q) => ({ ...q, _key: `s1_${q.id}`, _legacyKey: String(q.id), _stage: 1 }));
  const s2 = (course.questions_stage_2 || []).map((q) => ({ ...q, _key: `s2_${q.id}`, _legacyKey: null, _stage: 2 }));
  const s3 = (course.questions_stage_3 || []).map((q) => ({ ...q, _key: `s3_${q.id}`, _legacyKey: null, _stage: 3 }));
  if (stageVal === "1") return s1;
  if (stageVal === "2") return s2;
  if (stageVal === "3") return s3;
  return [...s1, ...s2, ...s3];
}

function getAnswer(prog, q) {
  if (prog.answers[q._key] !== undefined) return prog.answers[q._key];
  if (q._legacyKey && prog.answers[q._legacyKey] !== undefined) return prog.answers[q._legacyKey];
  return undefined;
}

function setAnswer(prog, q, val) {
  prog.answers[q._key] = val;
  if (q._legacyKey) delete prog.answers[q._legacyKey];
}

function isFlaggedQ(prog, q) {
  return !!(prog.flagged[q._key] || (q._legacyKey && prog.flagged[q._legacyKey]));
}

function toggleFlagQ(prog, q) {
  const next = !isFlaggedQ(prog, q);
  prog.flagged[q._key] = next;
  if (q._legacyKey) delete prog.flagged[q._legacyKey];
}

/* Lazy Pyodide Loader */
function setPyodideStatus(msg) {
  const pill = document.getElementById("pyodide-status-pill");
  if (pill) pill.textContent = msg;
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Gagal memuat script CDN: ${src}`));
    document.head.appendChild(s);
  });
}

async function ensurePyodide() {
  if (pyodideInstance) return pyodideInstance;
  if (!pyodideInitPromise) {
    pyodideInitPromise = (async () => {
      setPyodideStatus("⏳ Mengunduh runtime Pyodide v0.26.4...");
      await loadScriptOnce(`${PYODIDE_CDN}pyodide.js`);
      setPyodideStatus("⏳ Menginisialisasi Python di browser...");
      const py = await window.loadPyodide({ indexURL: PYODIDE_CDN });
      pyodideInstance = py;
      setPyodideStatus("✅ Pyodide v0.26.4 aktif di browser");
      return py;
    })().catch((err) => {
      pyodideInitPromise = null;
      setPyodideStatus("❌ Gagal memuat Pyodide (cek koneksi)");
      throw err;
    });
  }
  return pyodideInitPromise;
}

function detectCodePackages(codeStr) {
  const pkgs = [];
  if (/\bimport\s+numpy\b|\bfrom\s+numpy\b|\bnp\./.test(codeStr)) pkgs.push("numpy");
  if (/\bimport\s+pandas\b|\bfrom\s+pandas\b|\bpd\./.test(codeStr)) pkgs.push("pandas");
  const unsupported = [];
  for (const lib of ["scipy", "sklearn", "matplotlib"]) {
    if (new RegExp(`\\b(?:import|from)\\s+${lib}\\b`).test(codeStr)) unsupported.push(lib);
  }
  return { pkgs, unsupported };
}

async function runPythonInPyodide(userCode, testCode, extraPkgs = []) {
  const detected = detectCodePackages(`${userCode}\n${testCode}`);
  if (detected.unsupported.length > 0) {
    return {
      ok: false,
      tests_passed: false,
      stdout: "",
      error: `Pustaka ${detected.unsupported.join(", ")} tidak diaktifkan pada mode statis Pyodide (hanya Python standar, numpy, dan pandas yang dimuat).`,
    };
  }

  const py = await ensurePyodide();
  const needed = [...new Set([...extraPkgs, ...detected.pkgs])].filter(
    (p) => (p === "numpy" || p === "pandas") && !loadedPyodidePackages.has(p)
  );
  if (needed.length > 0) {
    setPyodideStatus(`⏳ Memuat paket lazy (${needed.join(", ")})...`);
    await py.loadPackage(needed);
    needed.forEach((p) => loadedPyodidePackages.add(p));
    setPyodideStatus(`✅ Pyodide siap (${[...loadedPyodidePackages].join(", ") || "stdlib"})`);
  }

  py.globals.set("__user_code__", userCode);
  py.globals.set("__test_code__", testCode || "");

  const runner = `
import io, json, sys, traceback
_buf_out = io.StringIO()
_old_out, _old_err = sys.stdout, sys.stderr
sys.stdout = _buf_out
sys.stderr = _buf_out
_res = {"ok": False, "tests_passed": False, "stdout": "", "error": ""}
_ns = {}
try:
    exec(compile(__user_code__, "<student_code>", "exec"), _ns, _ns)
    _res["ok"] = True
    if __test_code__.strip():
        exec(compile(__test_code__, "<unit_tests>", "exec"), _ns, _ns)
        _res["tests_passed"] = True
    else:
        _res["tests_passed"] = True
except AssertionError as _ae:
    _res["error"] = f"Uji otomatis gagal (AssertionError): {_ae}"
except Exception:
    _res["error"] = traceback.format_exc()
finally:
    sys.stdout = _old_out
    sys.stderr = _old_err
    _res["stdout"] = _buf_out.getvalue()
json.dumps(_res, ensure_ascii=False)
`;
  const rawJson = await py.runPythonAsync(runner);
  return JSON.parse(rawJson);
}

/* Initialization */
async function init() {
  applyTheme(getThemePref());
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (getThemePref() === "system") applyTheme("system");
    });
  }
  touchDailyStreak();
  bindGlobalEvents();

  try {
    const res = await fetch("data/courses_index.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.index = await res.json();
    await Promise.all(
      state.index.map(async (item) => {
        try {
          const r = await fetch(item.file);
          if (r.ok) state.coursesCache[item.id] = await r.json();
        } catch (e) {
          console.warn("Gagal memuat:", item.file);
        }
      })
    );
    const defaultId = getLastCourseId() || (state.index[0] && state.index[0].id);
    if (defaultId && state.coursesCache[defaultId]) {
      state.activeCourse = state.coursesCache[defaultId];
      syncActiveCourseViews();
    }
    renderDashboard();
    refreshGamifyUI();
    refreshSessionsCount();
  } catch (err) {
    document.getElementById("course-grid").innerHTML = `<div class="empty-state"><h4>Gagal Memuat Data</h4><p>Pastikan aplikasi dibuka lewat server statis atau GitHub Pages. (${escHtml(err.message)})</p></div>`;
  }
}

/* Navigation between 5 main sections */
function navigateTo(sectionName) {
  state.activeSection = sectionName;
  document.querySelectorAll(".page-section").forEach((s) => {
    s.classList.toggle("active", s.id === `sec-${sectionName}`);
  });
  document.querySelectorAll(".nav-item, .bnav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.nav === sectionName);
  });

  if (sectionName === "beranda") {
    renderDashboard();
  } else {
    if (!state.activeCourse && state.index.length) {
      openCourse(getLastCourseId() || state.index[0].id, sectionName);
      return;
    }
    renderCourseSwitchers();
    if (sectionName === "belajar") {
      renderChapterSidebar();
      renderChapterDetail();
      renderUasGaps();
      renderCheatSheet();
      if (!state.fcList.length && (state.activeCourse.chapters || []).length) {
        initFlashcardFilters();
      } else {
        renderFlashcard();
      }
    } else if (sectionName === "latihan") {
      if (!document.getElementById("quiz-filter-stage").options.length) {
        initQuizFilters();
      } else {
        renderCurrentQuestion();
      }
      renderPracticeSidebar();
      renderPracticeStage();
    } else if (sectionName === "statistik") {
      refreshGamifyUI();
      renderAnalyticsTab();
    }
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindGlobalEvents() {
  document.querySelectorAll(".nav-item, .bnav-item").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(btn.dataset.nav));
  });

  document.getElementById("btn-brand-home").addEventListener("click", () => navigateTo("beranda"));
  document.getElementById("mobile-brand-btn").addEventListener("click", () => navigateTo("beranda"));

  document.getElementById("btn-resume-last").addEventListener("click", () => {
    const lastId = getLastCourseId();
    if (lastId && state.coursesCache[lastId]) openCourse(lastId, "belajar");
  });

  document.getElementById("btn-theme-toggle").addEventListener("click", () => {
    const isDark = document.body.classList.contains("theme-dark");
    applyTheme(isDark ? "light" : "dark");
  });

  document.querySelectorAll("#theme-choices button").forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.themePref));
  });

  document.querySelectorAll(".filter-pills .pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-pills .pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.activeSemFilter = btn.dataset.sem;
      renderCourseGrid();
    });
  });

  document.getElementById("course-search").addEventListener("input", renderCourseGrid);

  // Subtabs inside Belajar and Latihan
  document.querySelectorAll("#sec-belajar .subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchBelajarTab(btn.dataset.subtab));
  });
  document.querySelectorAll("#sec-latihan .subtab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchLatihanTab(btn.dataset.subtab));
  });

  document.getElementById("modul-search").addEventListener("input", renderChapterSidebar);
  document.getElementById("btn-print-cheatsheet").addEventListener("click", () => window.print());

  // Quiz controls
  document.getElementById("quiz-filter-stage").addEventListener("change", (e) => {
    state.activeStage = e.target.value;
    populateQuizBabDropdown();
    applyQuizFilters(true);
  });

  ["quiz-filter-bab", "quiz-filter-priority", "quiz-filter-status"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => applyQuizFilters(true));
  });

  document.getElementById("btn-focus-uas").addEventListener("click", () => {
    const sel = document.getElementById("quiz-filter-priority");
    sel.value = sel.value === "Sangat Tinggi" ? "all" : "Sangat Tinggi";
    applyQuizFilters(true);
  });

  document.getElementById("btn-toggle-qgrid").addEventListener("click", () => {
    const drawer = document.getElementById("quiz-navigator-drawer");
    const isOpen = drawer.classList.toggle("open");
    if (isOpen) renderQuestionGrid();
  });

  document.getElementById("quiz-mode").addEventListener("change", (e) => {
    state.quizMode = e.target.value;
    const isExam = state.quizMode === "exam";
    document.getElementById("exam-timer").style.display = isExam ? "inline-flex" : "none";
    document.getElementById("btn-start-exam").style.display = isExam ? "inline-flex" : "none";
    if (!isExam) {
      stopExamTimer();
      state.examActive = false;
      state.examSubmitted = false;
    } else {
      state.examSubmitted = false;
      state.examSecondsLeft = 3600;
      document.getElementById("btn-start-exam").textContent = "Mulai Ujian";
      updateExamTimerUI();
    }
    renderCurrentQuestion();
    renderQuestionGrid();
  });

  document.getElementById("btn-start-exam").addEventListener("click", () => {
    if (!state.examActive) {
      state.examActive = true;
      state.examSubmitted = false;
      state.examSecondsLeft = 3600;
      document.getElementById("btn-start-exam").textContent = "Selesaikan & Koreksi";
      startExamTimer();
    } else {
      finishExam();
    }
    renderCurrentQuestion();
  });

  document.getElementById("btn-reset-quiz").addEventListener("click", () => {
    if (!state.activeCourse) return;
    if (!confirm("Reset semua jawaban soal pada mata kuliah ini?")) return;
    const p = getCourseProg(state.activeCourse.id);
    p.answers = {};
    p.flagged = {};
    state.examActive = false;
    state.examSubmitted = false;
    stopExamTimer();
    saveProgress();
    applyQuizFilters(true);
    updateCourseTopbar();
  });

  document.getElementById("btn-prev-q").addEventListener("click", () => {
    if (state.activeQIdx > 0) {
      state.activeQIdx--;
      renderCurrentQuestion();
      renderQuestionGrid();
    }
  });
  document.getElementById("btn-next-q").addEventListener("click", () => {
    if (state.activeQIdx < state.filteredQuestions.length - 1) {
      state.activeQIdx++;
      renderCurrentQuestion();
      renderQuestionGrid();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!state.activeCourse || state.activeSection !== "latihan" || state.activeLatihanTab !== "quiz") return;
    const tag = ((e.target && e.target.tagName) || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    const q = state.filteredQuestions[state.activeQIdx];
    if (!q) return;

    const keyMap = { "1": 0, "2": 1, "3": 2, "4": 3, "a": 0, "b": 1, "c": 2, "d": 3 };
    const k = e.key.toLowerCase();
    if (k in keyMap) {
      const btn = document.querySelector(`.option-btn[data-opt="${keyMap[k]}"]`);
      if (btn) btn.click();
    } else if (e.key === "ArrowLeft") {
      document.getElementById("btn-prev-q").click();
    } else if (e.key === "ArrowRight") {
      document.getElementById("btn-next-q").click();
    } else if (k === "f") {
      const fb = document.getElementById("btn-flag-q");
      if (fb) fb.click();
    }
  });

  // Flashcard controls
  document.getElementById("flashcard-box").addEventListener("click", () => {
    document.getElementById("flashcard-box").classList.toggle("flipped");
  });
  document.getElementById("fc-bab-filter").addEventListener("change", buildFlashcardList);
  document.getElementById("btn-fc-shuffle").addEventListener("click", () => {
    state.fcList.sort(() => Math.random() - 0.5);
    state.fcIdx = 0;
    renderFlashcard();
  });
  document.getElementById("btn-fc-prev").addEventListener("click", () => {
    if (state.fcIdx > 0) { state.fcIdx--; renderFlashcard(); }
  });
  document.getElementById("btn-fc-next").addEventListener("click", () => {
    if (state.fcIdx < state.fcList.length - 1) { state.fcIdx++; renderFlashcard(); }
  });

  // Sandbox Python button
  document.getElementById("btn-open-scratchpad").addEventListener("click", () => {
    state.sandboxMode = true;
    renderPracticeSidebar();
    renderSandboxStage();
  });

  // Analytics / MD Export
  document.getElementById("btn-refresh-md").addEventListener("click", renderAnalyticsTab);
  document.getElementById("btn-download-md").addEventListener("click", downloadSessionMd);
  document.getElementById("btn-save-md-local").addEventListener("click", saveSessionToLocalHistory);
  document.getElementById("btn-copy-md").addEventListener("click", () => {
    const box = document.getElementById("md-preview-box");
    navigator.clipboard.writeText(box.value);
    document.getElementById("save-status-msg").textContent = "✓ Teks Markdown disalin ke clipboard.";
  });

  // Settings backup & reset
  document.getElementById("btn-export-backup-json").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.progress, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cadangan_progres_portal_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("btn-reset-all-progress").addEventListener("click", () => {
    if (!confirm("Hapus seluruh progres belajar, skor, catatan, dan XP di browser ini?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state.progress = loadProgress();
    touchDailyStreak();
    refreshGamifyUI();
    refreshSessionsCount();
    renderDashboard();
    alert("Semua progres lokal berhasil direset.");
  });

  // Modal
  document.getElementById("btn-sessions-modal").addEventListener("click", openSessionsModal);
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    document.getElementById("sessions-modal").style.display = "none";
  });
  document.querySelector("#sessions-modal .modal-backdrop").addEventListener("click", () => {
    document.getElementById("sessions-modal").style.display = "none";
  });
}

function switchBelajarTab(subtabId) {
  state.activeBelajarTab = subtabId;
  document.querySelectorAll("#sec-belajar .subtab-btn").forEach((b) => b.classList.toggle("active", b.dataset.subtab === subtabId));
  document.querySelectorAll("#sec-belajar .subtab-panel").forEach((p) => p.classList.toggle("active", p.id === `subtab-${subtabId}`));
  if (subtabId === "flashcard") renderFlashcard();
}

function switchLatihanTab(subtabId) {
  state.activeLatihanTab = subtabId;
  document.querySelectorAll("#sec-latihan .subtab-btn").forEach((b) => b.classList.toggle("active", b.dataset.subtab === subtabId));
  document.querySelectorAll("#sec-latihan .subtab-panel").forEach((p) => p.classList.toggle("active", p.id === `subtab-${subtabId}`));
}

/* Dashboard */
function renderDashboard() {
  let totalQ = 0;
  let totalLabs = 0;
  let totalAnswered = 0;

  state.index.forEach((item) => {
    const c = state.coursesCache[item.id];
    if (!c) return;
    const qs = getStageQuestions(c, "all");
    totalQ += qs.length;
    totalLabs += (c.practice_labs || []).length;
    const prog = getCourseProg(item.id);
    totalAnswered += qs.filter((q) => getAnswer(prog, q) !== undefined).length;
  });

  document.getElementById("stat-total-courses").textContent = state.index.length;
  document.getElementById("stat-total-questions").textContent = totalQ;
  document.getElementById("stat-total-labs").textContent = totalLabs;
  const pct = totalQ ? Math.round((totalAnswered / totalQ) * 100) : 0;
  document.getElementById("stat-answered-overall").textContent = `${pct}%`;

  const lastId = getLastCourseId();
  const resumeBtn = document.getElementById("btn-resume-last");
  if (lastId && state.coursesCache[lastId]) {
    resumeBtn.style.display = "inline-flex";
    resumeBtn.textContent = `▶ Lanjut: ${state.coursesCache[lastId].title.split("(")[0].trim()}`;
  } else {
    resumeBtn.style.display = "none";
  }

  refreshGamifyUI();
  renderCourseGrid();
}

function renderCourseGrid() {
  const grid = document.getElementById("course-grid");
  const query = document.getElementById("course-search").value.trim().toLowerCase();

  const items = state.index.filter((item) => {
    if (state.activeSemFilter !== "all" && String(item.semester) !== state.activeSemFilter) return false;
    if (query && !`${item.title} ${item.code}`.toLowerCase().includes(query)) return false;
    return true;
  });

  if (!items.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--text-muted)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <h4>Mata kuliah tidak ditemukan</h4>
        <p>Coba kata kunci lain atau ubah filter semester.</p>
        <button class="btn btn-primary btn-sm" id="btn-clear-course-search">Tampilkan Semua</button>
      </div>`;
    document.getElementById("btn-clear-course-search").addEventListener("click", () => {
      document.getElementById("course-search").value = "";
      state.activeSemFilter = "all";
      document.querySelectorAll(".filter-pills .pill").forEach((b) => b.classList.toggle("active", b.dataset.sem === "all"));
      renderCourseGrid();
    });
    return;
  }

  grid.innerHTML = items
    .map((item) => {
      const c = state.coursesCache[item.id];
      const prog = getCourseProg(item.id);
      const theme = getCourseTheme(item.id);
      const qs = c ? getStageQuestions(c, "all") : [];
      const qCount = qs.length;
      const chapList = c ? (c.chapters || []) : [];
      const chapCount = chapList.length;
      const masteredCount = chapList.filter((ch) => prog.mastered[ch.bab]).length;
      const chapPct = chapCount ? Math.round((masteredCount / chapCount) * 100) : 0;

      const correctCount = qs.filter((q) => getAnswer(prog, q) === q.answer_index).length;
      const correctPct = qCount ? Math.round((correctCount / qCount) * 100) : 0;

      return `
      <div class="course-card" data-course-id="${item.id}" style="--card-pastel:${theme.color}">
        <div>
          <div class="course-card-head">
            <div class="course-emoji-box" aria-hidden="true">${theme.emoji}</div>
            <div class="course-badges">
              <span class="c-badge pastel">Sem ${item.semester}</span>
              <span class="c-badge">${escHtml(item.code)}</span>
            </div>
          </div>
          <h3>${escHtml(item.title)}</h3>
          <p>${escHtml(c ? c.description : "Memuat deskripsi...")}</p>
        </div>
        <div class="dual-progress">
          <div>
            <div class="prog-row-lbl"><span>📖 Bab Selesai</span><span>${masteredCount}/${chapCount} (${chapPct}%)</span></div>
            <div class="progress-track"><div class="progress-fill" style="width:${chapPct}%"></div></div>
          </div>
          <div>
            <div class="prog-row-lbl"><span>🎯 Soal Benar</span><span>${correctCount}/${qCount} (${correctPct}%)</span></div>
            <div class="progress-track"><div class="progress-fill quiz" style="width:${correctPct}%"></div></div>
          </div>
        </div>
      </div>`;
    })
    .join("");

  grid.querySelectorAll(".course-card").forEach((card) => {
    card.addEventListener("click", () => openCourse(card.dataset.courseId, "belajar"));
  });
}

function syncActiveCourseViews() {
  if (!state.activeCourse) return;
  updateCourseTopbar();
  renderCourseSwitchers();
  renderChapterSidebar();
  renderChapterDetail();
  renderUasGaps();
  renderCheatSheet();
  initQuizFilters();
  initFlashcardFilters();
  renderPracticeSidebar();
  renderPracticeStage();
}

async function openCourse(courseId, targetSection = "belajar") {
  let course = state.coursesCache[courseId];
  if (!course) {
    const meta = state.index.find((x) => x.id === courseId);
    const r = await fetch(meta.file);
    course = await r.json();
    state.coursesCache[courseId] = course;
  }
  state.activeCourse = course;
  state.activeChapterIdx = 0;
  state.activeLabIdx = 0;
  state.sandboxMode = false;
  state.examActive = false;
  state.examSubmitted = false;
  stopExamTimer();
  setLastCourseId(courseId);
  document.getElementById("quiz-navigator-drawer")?.classList.remove("open");

  syncActiveCourseViews();
  navigateTo(targetSection);
}

function updateCourseTopbar() {
  const c = state.activeCourse;
  if (!c) return;
  const theme = getCourseTheme(c.id);
  const prog = getCourseProg(c.id);

  document.getElementById("topbar-course-pill").style.display = "flex";
  document.getElementById("crumb-emoji").textContent = theme.emoji;
  document.getElementById("crumb-title").textContent = c.title;
  document.getElementById("crumb-sem").textContent = `Sem ${c.semester}`;

  const sideBox = document.getElementById("sidebar-active-course");
  if (sideBox) {
    sideBox.style.display = "block";
    sideBox.style.background = theme.color;
    document.getElementById("side-course-name").textContent = `${theme.emoji} ${c.title}`;
  }

  document.getElementById("tab-badge-gaps").textContent = (c.uas_gaps || []).length;
  document.getElementById("tab-badge-labs").textContent = (c.practice_labs || []).length;
  document.getElementById("tab-badge-quiz").textContent = getStageQuestions(c, "all").length;

  const qs = getStageQuestions(c, "all");
  const ansCount = qs.filter((q) => getAnswer(prog, q) !== undefined).length;
  const correctCount = qs.filter((q) => getAnswer(prog, q) === q.answer_index).length;
  const accPct = ansCount ? Math.round((correctCount / ansCount) * 100) : 0;
  document.getElementById("quiz-live-score").textContent = `Skor: ${correctCount}/${ansCount} (${ansCount ? accPct + "%" : "-"})`;
}

function renderCourseSwitchers() {
  const c = state.activeCourse;
  if (!c) return;
  const theme = getCourseTheme(c.id);
  const options = state.index
    .map((x) => `<option value="${x.id}" ${x.id === c.id ? "selected" : ""}>${getCourseTheme(x.id).emoji} Sem ${x.semester} — ${escHtml(x.title)} (${escHtml(x.code)})</option>`)
    .join("");

  const makeHtml = (prefix) => `
    <div class="course-switcher-select-wrap">
      <span class="c-badge pastel" style="background:${theme.color};color:#24233A;">${theme.emoji} Semester ${c.semester}</span>
      <select id="course-select-${prefix}" name="course_select_${prefix}" class="course-select-dd" aria-label="Pilih Mata Kuliah">${options}</select>
    </div>
    <div class="course-switcher-actions">
      ${prefix === "belajar" ? `<button class="btn btn-primary btn-sm quick-goto-latihan">📝 Langsung Latihan Soal</button>` : ""}
      ${prefix === "latihan" ? `<button class="btn btn-ghost btn-sm quick-goto-belajar">📖 Kembali ke Modul</button>` : ""}
      <button class="btn btn-ghost btn-sm quick-goto-stat">📊 Analitik &amp; Ekspor MD</button>
    </div>`;

  [
    ["belajar-course-bar", "belajar"],
    ["latihan-course-bar", "latihan"],
    ["statistik-course-bar", "stat"],
  ].forEach(([elId, kind]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = makeHtml(kind);
    el.querySelector(".course-select-dd").addEventListener("change", (e) => {
      openCourse(e.target.value, state.activeSection);
    });
    const bLat = el.querySelector(".quick-goto-latihan");
    if (bLat) bLat.addEventListener("click", () => navigateTo("latihan"));
    const bBel = el.querySelector(".quick-goto-belajar");
    if (bBel) bBel.addEventListener("click", () => navigateTo("belajar"));
    const bStat = el.querySelector(".quick-goto-stat");
    if (bStat) bStat.addEventListener("click", () => navigateTo("statistik"));
  });
}

/* BELAJAR: MODUL BACA */
function renderChapterSidebar() {
  const c = state.activeCourse;
  const prog = getCourseProg(c.id);
  const q = document.getElementById("modul-search").value.trim().toLowerCase();
  const list = document.getElementById("chapter-list");

  const filtered = (c.chapters || []).map((ch, idx) => ({ ch, idx })).filter(({ ch }) => {
    if (!q) return true;
    return `${ch.bab} ${ch.title} ${ch.content_md}`.toLowerCase().includes(q);
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state" style="padding:18px;"><p style="margin:0;">Topik tidak ditemukan.</p></div>`;
    return;
  }

  list.innerHTML = filtered
    .map(({ ch, idx }) => {
      const isMastered = !!prog.mastered[ch.bab];
      return `
      <div class="chapter-item ${idx === state.activeChapterIdx ? "active" : ""}" data-idx="${idx}">
        <div class="chapter-item-top">
          <span>${escHtml(ch.bab)} ${isMastered ? "✅" : ""}</span>
          <span class="prio-badge ${prioClass(ch.uas_priority)}">${escHtml(ch.uas_priority)}</span>
        </div>
        <div class="chapter-item-title">${escHtml(ch.title)}</div>
      </div>`;
    })
    .join("");

  list.querySelectorAll(".chapter-item").forEach((el) => {
    el.addEventListener("click", () => {
      state.activeChapterIdx = Number(el.dataset.idx);
      renderChapterSidebar();
      renderChapterDetail();
    });
  });
}

function renderChapterDetail() {
  const c = state.activeCourse;
  const ch = (c.chapters || [])[state.activeChapterIdx];
  const card = document.getElementById("chapter-detail");
  if (!ch) {
    card.innerHTML = `<div class="empty-state"><h4>Bab belum tersedia</h4><p>Pilih bab lain dari daftar.</p></div>`;
    return;
  }
  const prog = getCourseProg(c.id);
  const isMastered = !!prog.mastered[ch.bab];
  const noteVal = prog.notes[ch.bab] || "";

  const summaryHtml = (ch.summary_points || []).map((p) => `<li>${renderInlineMd(p)}</li>`).join("");
  const formulaHtml = (ch.formulas_or_syntax || []).map((f) => `<li>${renderInlineMd(f)}</li>`).join("");
  const trapsHtml = (ch.common_traps || []).map((t) => `<li>${renderInlineMd(t)}</li>`).join("");

  card.innerHTML = `
    <div class="chapter-head-actions">
      <div>
        <span class="prio-badge ${prioClass(ch.uas_priority)}">Prioritas UAS: ${escHtml(ch.uas_priority)}</span>
        <h2 style="margin:6px 0 0;">${escHtml(ch.bab)}: ${escHtml(ch.title)}</h2>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="btn-toggle-mastered" class="btn ${isMastered ? "btn-primary" : "btn-ghost"}">
          ${isMastered ? "✅ Sudah Dipahami" : "☐ Tandai Paham (+20 XP)"}
        </button>
        <button id="btn-practice-this-bab" class="btn btn-accent">📝 Latihan Bab Ini</button>
      </div>
    </div>

    <div class="callout-grid">
      <div class="callout-box">
        <h4>Poin Inti Wajib Hafal</h4>
        <ul>${summaryHtml}</ul>
      </div>
      ${formulaHtml ? `<div class="callout-box"><h4>Rumus / Sintaks Kunci</h4><ul>${formulaHtml}</ul></div>` : ""}
      ${trapsHtml ? `<div class="callout-box trap"><h4>⚠ Jebakan Sering Muncul di UAS</h4><ul>${trapsHtml}</ul></div>` : ""}
    </div>

    <div class="markdown-body" id="chapter-md-body">${renderMd(ch.content_md)}</div>

    <div class="notes-box">
      <label for="chapter-note-input" style="font-size:14px;font-weight:700;display:block;margin-bottom:6px;">📝 Catatan Belajar Pribadi (${escHtml(ch.bab)})</label>
      <textarea id="chapter-note-input" placeholder="Tulis poin yang masih membingungkan atau trik cepat Anda di sini...">${escHtml(noteVal)}</textarea>
    </div>
  `;

  applyMath(card);

  document.getElementById("btn-toggle-mastered").addEventListener("click", () => {
    prog.mastered[ch.bab] = !prog.mastered[ch.bab];
    if (prog.mastered[ch.bab]) awardXp(`bab_${c.id}_${ch.bab}`, 20);
    saveProgress();
    refreshGamifyUI();
    renderChapterSidebar();
    renderChapterDetail();
  });

  document.getElementById("btn-practice-this-bab").addEventListener("click", () => {
    document.getElementById("quiz-filter-bab").value = ch.bab;
    applyQuizFilters(true);
    switchLatihanTab("quiz");
    navigateTo("latihan");
  });

  document.getElementById("chapter-note-input").addEventListener("input", (e) => {
    prog.notes[ch.bab] = e.target.value;
    saveProgress();
  });
}

function renderUasGaps() {
  const c = state.activeCourse;
  const wrap = document.getElementById("uas-gaps-list");
  const gaps = c.uas_gaps || [];
  if (!gaps.length) {
    wrap.innerHTML = `<div class="empty-state"><h4>Tidak ada catatan tambahan</h4><p>Semua topik pada mata kuliah ini sudah terwakili di modul utama.</p></div>`;
    return;
  }
  wrap.innerHTML = gaps
    .map(
      (g, i) => `
    <div class="gap-card">
      <div class="gap-source">Topik Tambahan #${i + 1} • ${escHtml(g.source_hint || "BMP / Potensial UAS")}</div>
      <h3 style="margin:0 0 8px;">${escHtml(g.topic)}</h3>
      <p style="font-size:14px;color:var(--text-muted);margin:0 0 12px;"><strong>Mengapa Penting untuk UAS:</strong> ${escHtml(g.why_important)}</p>
      <div class="markdown-body">${renderMd(g.content_md)}</div>
    </div>`
    )
    .join("");
  applyMath(wrap);
}

function renderCheatSheet() {
  const c = state.activeCourse;
  const grid = document.getElementById("cheatsheet-grid");
  grid.innerHTML = (c.chapters || [])
    .map(
      (ch) => `
    <div class="cheat-card">
      <span class="prio-badge ${prioClass(ch.uas_priority)}">${escHtml(ch.bab)} • UAS: ${escHtml(ch.uas_priority)}</span>
      <h4 style="margin:6px 0 10px;">${escHtml(ch.title)}</h4>
      <strong style="font-size:13px;">Poin Inti:</strong>
      <ul style="font-size:14px;">${(ch.summary_points || []).map((p) => `<li>${renderInlineMd(p)}</li>`).join("")}</ul>
      ${(ch.formulas_or_syntax || []).length ? `<strong style="font-size:13px;">Rumus / Sintaks:</strong><ul style="font-size:14px;">${ch.formulas_or_syntax.map((f) => `<li>${renderInlineMd(f)}</li>`).join("")}</ul>` : ""}
      ${(ch.common_traps || []).length ? `<strong style="font-size:13px;">Jebakan UAS:</strong><ul style="font-size:14px;">${ch.common_traps.map((t) => `<li>${renderInlineMd(t)}</li>`).join("")}</ul>` : ""}
    </div>`
    )
    .join("");
  applyMath(grid);
}

/* LATIHAN: SIMULASI SOAL */
function initQuizFilters() {
  const c = state.activeCourse;
  const stageSel = document.getElementById("quiz-filter-stage");
  const opts = [`<option value="1">Tahap 1 (${(c.questions_stage_1 || []).length} Soal)</option>`];
  if ((c.questions_stage_2 || []).length) opts.push(`<option value="2">Tahap 2 (${c.questions_stage_2.length} Soal)</option>`);
  if ((c.questions_stage_3 || []).length) opts.push(`<option value="3">Tahap 3 (${c.questions_stage_3.length} Soal)</option>`);
  if ((c.questions_stage_2 || []).length || (c.questions_stage_3 || []).length) {
    opts.push(`<option value="all">Semua Tahap (${getStageQuestions(c, "all").length} Soal)</option>`);
  }
  stageSel.innerHTML = opts.join("");
  state.activeStage = "1";
  stageSel.value = "1";

  populateQuizBabDropdown();
  document.getElementById("quiz-filter-priority").value = "all";
  document.getElementById("quiz-filter-status").value = "all";
  document.getElementById("quiz-mode").value = "instant";
  state.quizMode = "instant";
  document.getElementById("exam-timer").style.display = "none";
  document.getElementById("btn-start-exam").style.display = "none";
  applyQuizFilters(true);
}

function populateQuizBabDropdown() {
  const c = state.activeCourse;
  const qs = getStageQuestions(c, state.activeStage);
  const sel = document.getElementById("quiz-filter-bab");
  const babs = [...new Set(qs.map((q) => q.bab))];
  sel.innerHTML = `<option value="all">Semua Bab (${qs.length})</option>` +
    babs.map((b) => `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join("");
}

function applyQuizFilters(resetIndex = false) {
  const c = state.activeCourse;
  const prog = getCourseProg(c.id);
  const bab = document.getElementById("quiz-filter-bab").value;
  const prio = document.getElementById("quiz-filter-priority").value;
  const status = document.getElementById("quiz-filter-status").value;

  state.filteredQuestions = getStageQuestions(c, state.activeStage).filter((q) => {
    if (bab !== "all" && q.bab !== bab) return false;
    if (prio !== "all" && q.uas_priority !== prio) return false;
    const chosen = getAnswer(prog, q);
    if (status === "unanswered" && chosen !== undefined) return false;
    if (status === "wrong" && (chosen === undefined || chosen === q.answer_index)) return false;
    if (status === "flagged" && !isFlaggedQ(prog, q)) return false;
    return true;
  });

  if (resetIndex || state.activeQIdx >= state.filteredQuestions.length) {
    state.activeQIdx = 0;
  }
  renderCurrentQuestion();
  renderQuestionGrid();
}

function checkStageCompletionCelebration(course, prog, stageNum) {
  const stageQs = getStageQuestions(course, String(stageNum));
  if (!stageQs.length) return;
  const allAnswered = stageQs.every((q) => getAnswer(prog, q) !== undefined);
  if (!allAnswered) return;
  const g = getGamify();
  const ckey = `${course.id}_s${stageNum}`;
  g.badges.stage_clear = true;
  if (!g.stageCelebrated[ckey]) {
    g.stageCelebrated[ckey] = true;
    saveProgress();
    launchSubtleConfetti();
  }
}

function renderCurrentQuestion() {
  const stage = document.getElementById("question-stage");
  const c = state.activeCourse;
  const prog = getCourseProg(c.id);

  if (!state.filteredQuestions.length) {
    stage.innerHTML = `
      <div class="empty-state">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--text-muted)"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <h4>Tidak ada soal pada filter ini</h4>
        <p>Bagus! Mungkin belum ada soal salah atau semua soal pada filter ini sudah selesai dikerjakan.</p>
        <button class="btn btn-primary" id="btn-reset-q-filters">Tampilkan Semua Soal</button>
      </div>`;
    document.getElementById("q-counter").textContent = "0 / 0";
    document.getElementById("quiz-progress-fill").style.width = "0%";
    document.getElementById("btn-reset-q-filters").addEventListener("click", () => {
      document.getElementById("quiz-filter-bab").value = "all";
      document.getElementById("quiz-filter-priority").value = "all";
      document.getElementById("quiz-filter-status").value = "all";
      applyQuizFilters(true);
    });
    return;
  }

  const q = state.filteredQuestions[state.activeQIdx];
  const chosen = getAnswer(prog, q);
  const isFlagged = isFlaggedQ(prog, q);
  const showCorrection =
    (state.quizMode === "instant" && chosen !== undefined) ||
    (state.quizMode === "exam" && state.examSubmitted);

  const letters = ["A", "B", "C", "D"];
  const optionsHtml = q.options
    .map((opt, i) => {
      let cls = "option-btn";
      if (chosen === i) cls += " selected";
      if (showCorrection) {
        if (i === q.answer_index) cls += " correct";
        else if (chosen === i && i !== q.answer_index) cls += " wrong";
      }
      return `
      <button class="${cls}" data-opt="${i}">
        <span class="opt-letter">${letters[i]}</span>
        <span>${renderInlineMd(opt)}</span>
      </button>`;
    })
    .join("");

  let explHtml = "";
  if (showCorrection) {
    const isCorrect = chosen === q.answer_index;
    explHtml = `
      <details class="explanation-details ${isCorrect ? "ok" : "bad"}" open>
        <summary>
          <span>${isCorrect ? "✅ Jawaban Benar! (+10 XP)" : `❌ Kurang Tepat — Kunci: ${letters[q.answer_index]}`}</span>
          <span style="font-size:12px;">Buka / Tutup Pembahasan ▾</span>
        </summary>
        <div class="explanation-body">
          <div class="markdown-body">${renderMd(q.explanation)}</div>
          <div class="row-between" style="margin-top:12px;font-size:13px;">
            <span>📚 Bagian Terkait: <strong>${escHtml(q.remedial_section || q.bab)}</strong></span>
            <button class="btn btn-ghost btn-sm" id="btn-jump-remedial">Buka Materi ${escHtml(q.bab)} →</button>
          </div>
        </div>
      </details>`;
  }

  stage.innerHTML = `
    <div class="q-header">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span class="c-badge pastel" style="background:var(--baby-blue);color:var(--baby-blue-ink);">Soal #${q.id}</span>
        <span class="c-badge">${escHtml(q.bab)}</span>
        <span class="prio-badge ${prioClass(q.uas_priority)}">UAS: ${escHtml(q.uas_priority)}</span>
      </div>
      <button id="btn-flag-q" class="btn btn-ghost btn-sm">${isFlagged ? "🚩 Ditandai Sulit" : "🏳 Tandai Sulit"}</button>
    </div>
    <div class="q-text markdown-body">${renderMd(q.question)}</div>
    <div class="options-list">${optionsHtml}</div>
    ${explHtml}
  `;

  applyMath(stage);

  document.getElementById("q-counter").textContent = `Soal ${state.activeQIdx + 1} / ${state.filteredQuestions.length}`;
  const answeredInFilter = state.filteredQuestions.filter((item) => getAnswer(prog, item) !== undefined).length;
  document.getElementById("quiz-progress-fill").style.width = `${Math.round((answeredInFilter / state.filteredQuestions.length) * 100)}%`;

  stage.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (state.quizMode === "exam" && !state.examActive && !state.examSubmitted) {
        alert("Klik 'Mulai Ujian' terlebih dahulu untuk memulai simulasi ber-timer.");
        return;
      }
      if (state.quizMode === "exam" && state.examSubmitted) return;
      const optIdx = Number(btn.dataset.opt);
      const firstAttempt = getAnswer(prog, q) === undefined;
      setAnswer(prog, q, optIdx);
      const g = getGamify();
      if (firstAttempt) {
        if (optIdx === q.answer_index) {
          g.correctRun++;
          if (g.correctRun > g.maxCorrectRun) g.maxCorrectRun = g.correctRun;
          awardXp(`q_${c.id}_${q._key}`, 10);
        } else {
          g.correctRun = 0;
        }
      }
      saveProgress();
      checkStageCompletionCelebration(c, prog, q._stage);
      refreshGamifyUI();
      updateCourseTopbar();
      renderCurrentQuestion();
      renderQuestionGrid();
    });
  });

  document.getElementById("btn-flag-q").addEventListener("click", () => {
    toggleFlagQ(prog, q);
    saveProgress();
    renderCurrentQuestion();
    renderQuestionGrid();
  });

  const jumpBtn = document.getElementById("btn-jump-remedial");
  if (jumpBtn) {
    jumpBtn.addEventListener("click", () => {
      const idx = (c.chapters || []).findIndex((ch) => ch.bab === q.bab);
      if (idx >= 0) {
        state.activeChapterIdx = idx;
        switchBelajarTab("modul");
        navigateTo("belajar");
      }
    });
  }
}

function renderQuestionGrid() {
  const grid = document.getElementById("question-grid");
  const prog = getCourseProg(state.activeCourse.id);
  const showCorrection = state.quizMode === "instant" || state.examSubmitted;

  grid.innerHTML = state.filteredQuestions
    .map((q, idx) => {
      const chosen = getAnswer(prog, q);
      let cls = "q-dot";
      if (idx === state.activeQIdx) cls += " current";
      if (isFlaggedQ(prog, q)) cls += " flagged";
      if (chosen !== undefined) {
        if (!showCorrection) cls += " answered";
        else cls += chosen === q.answer_index ? " correct" : " wrong";
      }
      return `<button class="${cls}" data-qidx="${idx}">${q.id}</button>`;
    })
    .join("");

  grid.querySelectorAll(".q-dot").forEach((b) => {
    b.addEventListener("click", () => {
      state.activeQIdx = Number(b.dataset.qidx);
      renderCurrentQuestion();
      renderQuestionGrid();
    });
  });
}

function startExamTimer() {
  stopExamTimer();
  state.examTimerHandle = setInterval(() => {
    state.examSecondsLeft--;
    updateExamTimerUI();
    if (state.examSecondsLeft <= 0) finishExam();
  }, 1000);
}

function stopExamTimer() {
  if (state.examTimerHandle) {
    clearInterval(state.examTimerHandle);
    state.examTimerHandle = null;
  }
}

function updateExamTimerUI() {
  const m = String(Math.floor(state.examSecondsLeft / 60)).padStart(2, "0");
  const s = String(state.examSecondsLeft % 60).padStart(2, "0");
  document.getElementById("exam-timer").textContent = `⏱️ ${m}:${s}`;
}

function finishExam() {
  stopExamTimer();
  state.examActive = false;
  state.examSubmitted = true;
  document.getElementById("btn-start-exam").textContent = "Mulai Ujian Baru";
  renderCurrentQuestion();
  renderQuestionGrid();
  navigateTo("statistik");
}

/* FLASHCARD */
function initFlashcardFilters() {
  const c = state.activeCourse;
  const sel = document.getElementById("fc-bab-filter");
  const babs = (c.chapters || []).map((ch) => ch.bab);
  sel.innerHTML = `<option value="all">Semua Bab</option>` + babs.map((b) => `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join("");
  buildFlashcardList();
}

function buildFlashcardList() {
  const c = state.activeCourse;
  const bab = document.getElementById("fc-bab-filter").value;
  state.fcList = (c.chapters || []).filter((ch) => bab === "all" || ch.bab === bab);
  state.fcIdx = 0;
  renderFlashcard();
}

function renderFlashcard() {
  const box = document.getElementById("flashcard-box");
  if (!box) return;
  box.classList.remove("flipped");
  if (!state.fcList.length) return;
  const ch = state.fcList[state.fcIdx];
  document.getElementById("fc-tag").textContent = `${ch.bab} • Prioritas UAS: ${ch.uas_priority}`;
  document.getElementById("fc-front-title").textContent = ch.title;
  document.getElementById("fc-front-body").innerHTML = `<ul>${(ch.summary_points || []).map((p) => `<li>${renderInlineMd(p)}</li>`).join("")}</ul>`;
  const formulas = (ch.formulas_or_syntax || []).map((f) => `<li>${renderInlineMd(f)}</li>`).join("");
  const traps = (ch.common_traps || []).map((t) => `<li>${renderInlineMd(t)}</li>`).join("");
  document.getElementById("fc-back-body").innerHTML = `
    ${formulas ? `<h4>Rumus / Sintaks</h4><ul>${formulas}</ul>` : ""}
    ${traps ? `<h4>Jebakan UAS</h4><ul>${traps}</ul>` : ""}
  `;
  document.getElementById("fc-counter").textContent = `${state.fcIdx + 1} / ${state.fcList.length}`;
  applyMath(box);
}

/* LAB PRAKTEK & PYODIDE */
function renderPracticeSidebar() {
  const c = state.activeCourse;
  const prog = getCourseProg(c.id);
  const list = document.getElementById("practice-list");
  const labs = c.practice_labs || [];

  list.innerHTML = labs
    .map((lab, idx) => {
      const done = !!prog.labPassed[lab.id];
      let badge = "📋 Kasus";
      if (lab.mode === "python") {
        badge = lab.readonly_unsupported ? "🔒 Baca-Saja" : "🐍 Pyodide";
      }
      return `
      <div class="practice-item ${!state.sandboxMode && idx === state.activeLabIdx ? "active" : ""}" data-lidx="${idx}">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px;">
          <span>${escHtml(lab.bab)} • ${badge}</span>
          <span>${done ? "✅ Selesai" : ""}</span>
        </div>
        <strong>#${lab.id} ${escHtml(lab.title)}</strong>
      </div>`;
    })
    .join("");

  list.querySelectorAll(".practice-item").forEach((el) => {
    el.addEventListener("click", () => {
      state.sandboxMode = false;
      state.activeLabIdx = Number(el.dataset.lidx);
      renderPracticeSidebar();
      renderPracticeStage();
    });
  });
}

function attachEditorShortcuts(editor, runFn) {
  editor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, s) + "    " + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = s + 4;
    } else if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      runFn();
    }
  });
}

function renderSandboxStage() {
  const stage = document.getElementById("practice-stage");
  const prog = getCourseProg(state.activeCourse.id);
  const saved = prog.notes.__sandbox || "import numpy as np\n\n# Eksperimen bebas Python di browser (Pyodide)\n# Paket tersedia secara lazy: Python stdlib, numpy, pandas\ndata = np.array([12, 15, 18, 21, 24])\nprint('Mean:', data.mean(), '| Std sampel:', data.std(ddof=1))\n";
  stage.innerHTML = `
    <div style="margin-bottom:10px;"><span class="c-badge pastel" style="background:var(--lavender);color:var(--lavender-ink);">Sandbox Python (Pyodide v0.26.4)</span></div>
    <h3 style="margin:0 0 8px;">🧪 Scratchpad Eksperimen Python</h3>
    <p class="muted" style="margin:0 0 12px;">Berjalan 100% di browser tanpa server. Paket <code>numpy</code> dan <code>pandas</code> dimuat otomatis (<em>lazy</em>) hanya jika Anda mengimpornya.</p>
    <textarea id="sandbox-editor" class="code-editor" aria-label="Editor Sandbox Python" spellcheck="false">${escHtml(saved)}</textarea>
    <div class="practice-actions">
      <button id="btn-run-sandbox" class="btn btn-primary">▶ Jalankan di Pyodide (Ctrl+Enter)</button>
    </div>
    <div id="lab-output" class="output-console" style="display:none;"></div>
  `;
  const editor = document.getElementById("sandbox-editor");
  editor.addEventListener("input", () => {
    prog.notes.__sandbox = editor.value;
    saveProgress();
  });
  const runSandbox = async () => {
    const outEl = document.getElementById("lab-output");
    outEl.style.display = "block";
    outEl.textContent = "⏳ Menyiapkan Pyodide & menjalankan kode...";
    try {
      const data = await runPythonInPyodide(editor.value, "");
      outEl.textContent = (data.stdout || "") + (data.error ? `\n[ERROR]:\n${data.error}` : "") || "(Selesai tanpa output)";
    } catch (err) {
      outEl.textContent = `Gagal menjalankan Pyodide: ${err.message}`;
    }
  };
  attachEditorShortcuts(editor, runSandbox);
  document.getElementById("btn-run-sandbox").addEventListener("click", runSandbox);
}

function renderPracticeStage() {
  const c = state.activeCourse;
  const labs = c.practice_labs || [];
  const stage = document.getElementById("practice-stage");
  if (!labs.length) {
    stage.innerHTML = `<div class="empty-state"><h4>Belum ada lab praktek</h4><p>Pilih mata kuliah lain untuk mencoba latihan live coding.</p></div>`;
    return;
  }
  const lab = labs[state.activeLabIdx];
  const prog = getCourseProg(c.id);
  const isPython = lab.mode === "python";

  if (isPython && lab.readonly_unsupported) {
    const libsStr = (lab.unsupported_libs || []).join(", ");
    stage.innerHTML = `
      <div class="row-between" style="margin-bottom:10px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span class="c-badge">${escHtml(lab.bab)}</span>
          <span class="c-badge pastel" style="background:var(--peach);color:var(--peach-ink);">🔒 Contoh Baca-Saja (Library: ${escHtml(libsStr)})</span>
        </div>
        <span id="lab-detail-status">${prog.labPassed[lab.id] ? "✅ Sudah Dipelajari" : "📖 Referensi Baca-Saja"}</span>
      </div>
      <div class="readonly-banner">
        <strong>Info Mode Statis:</strong> Soal ini membutuhkan <code>${escHtml(libsStr)}</code> di luar paket aktif Pyodide (<code>stdlib</code>, <code>numpy</code>, <code>pandas</code>). Kode lengkap dan output referensi ditampilkan di bawah untuk dipelajari.
      </div>
      <h3 style="margin:0 0 10px;">Lab #${lab.id}: ${escHtml(lab.title)}</h3>
      <div class="markdown-body" style="margin-bottom:14px;">${renderMd(lab.prompt)}</div>

      <strong style="font-size:14px;">Kode Referensi (Baca-Saja):</strong>
      <pre class="readonly-code"><code>${escHtml(lab.solution_code)}</code></pre>

      ${lab.test_code ? `<strong style="font-size:14px;">Uji Verifikasi (Assert):</strong><pre class="readonly-code"><code>${escHtml(lab.test_code)}</code></pre>` : ""}

      <strong style="font-size:14px;">Output yang Diharapkan:</strong>
      <div class="output-console" style="margin-bottom:14px;">${escHtml(lab.expected_output || "(Semua assertion lulus.)")}</div>

      <div class="practice-actions">
        <button id="btn-mark-readonly-done" class="btn ${prog.labPassed[lab.id] ? "btn-primary" : "btn-ghost"}">
          ${prog.labPassed[lab.id] ? "✅ Sudah Dipelajari" : "☐ Tandai Sudah Dipelajari (+15 XP)"}
        </button>
      </div>
      <details class="explanation-details ok" open>
        <summary><span>💡 Pembahasan</span><span style="font-size:12px;">Buka / Tutup ▾</span></summary>
        <div class="explanation-body markdown-body">${renderMd(lab.explanation)}</div>
      </details>
    `;
    applyMath(stage);
    document.getElementById("btn-mark-readonly-done").addEventListener("click", () => {
      prog.labPassed[lab.id] = !prog.labPassed[lab.id];
      if (prog.labPassed[lab.id]) awardXp(`lab_${c.id}_${lab.id}`, 15);
      saveProgress();
      refreshGamifyUI();
      renderPracticeSidebar();
      renderPracticeStage();
    });
    return;
  }

  const savedCode = prog.labCode[lab.id] !== undefined ? prog.labCode[lab.id] : (lab.starter_code || "");
  const pkgInfo = (lab.required_packages || []).length
    ? ` • Paket lazy: ${lab.required_packages.join(", ")}`
    : "";

  stage.innerHTML = `
    <div class="row-between" style="margin-bottom:10px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span class="c-badge">${escHtml(lab.bab)}</span>
        <span class="c-badge pastel" style="background:var(--baby-blue);color:var(--baby-blue-ink);">${isPython ? `Live Coding Pyodide${escHtml(pkgInfo)}` : "Latihan Analisis Kasus"}</span>
      </div>
      <span id="lab-detail-status">${prog.labPassed[lab.id] ? "✅ Status: Lulus Uji" : "⏳ Belum Lulus"}</span>
    </div>
    <h3 style="margin:0 0 10px;">Lab #${lab.id}: ${escHtml(lab.title)}</h3>
    <div class="markdown-body" style="margin-bottom:14px;">${renderMd(lab.prompt)}</div>

    <textarea id="lab-code-editor" class="code-editor" aria-label="Editor Jawaban atau Kode Lab" spellcheck="false">${escHtml(savedCode)}</textarea>
    <div class="practice-actions">
      <button id="btn-run-lab" class="btn btn-primary">${isPython ? "▶ Jalankan & Uji di Pyodide" : "✔ Evaluasi Jawaban (Rubrik)"}</button>
      <button id="btn-reset-lab" class="btn btn-ghost">↺ Reset</button>
      <button id="btn-toggle-solution" class="btn btn-accent">💡 Lihat Solusi</button>
    </div>
    <div id="lab-output" class="output-console" style="display:none;"></div>
    <div id="lab-solution-box" class="explanation-details ok" style="display:none;padding:14px;margin-top:14px;">
      <strong>Solusi Referensi &amp; Pembahasan:</strong>
      <pre class="readonly-code"><code>${escHtml(lab.solution_code)}</code></pre>
      <div class="markdown-body">${renderMd(lab.explanation)}</div>
    </div>
  `;

  applyMath(stage);

  const editor = document.getElementById("lab-code-editor");
  editor.addEventListener("input", () => {
    prog.labCode[lab.id] = editor.value;
    saveProgress();
  });
  attachEditorShortcuts(editor, runActiveLab);

  document.getElementById("btn-run-lab").addEventListener("click", runActiveLab);
  document.getElementById("btn-reset-lab").addEventListener("click", () => {
    editor.value = lab.starter_code || "";
    prog.labCode[lab.id] = editor.value;
    saveProgress();
  });
  document.getElementById("btn-toggle-solution").addEventListener("click", () => {
    const sb = document.getElementById("lab-solution-box");
    sb.style.display = sb.style.display === "none" ? "block" : "none";
  });
}

async function runActiveLab() {
  const c = state.activeCourse;
  const lab = c.practice_labs[state.activeLabIdx];
  const prog = getCourseProg(c.id);
  const code = document.getElementById("lab-code-editor").value;
  const outEl = document.getElementById("lab-output");
  outEl.style.display = "block";

  if (lab.mode === "python") {
    outEl.textContent = "⏳ Memuat Pyodide & menjalankan kode di browser...";
    try {
      const data = await runPythonInPyodide(code, lab.test_code || "", lab.required_packages || []);
      let msg = "";
      if (data.tests_passed) {
        prog.labPassed[lab.id] = true;
        awardXp(`lab_${c.id}_${lab.id}`, 15);
        saveProgress();
        refreshGamifyUI();
        renderPracticeSidebar();
        const stEl = document.getElementById("lab-detail-status");
        if (stEl) stEl.textContent = "✅ Status: Lulus Uji";
        msg += "✅ SEMUA UJI OTOMATIS LULUS (Pyodide)! (+15 XP)\n\n";
      } else {
        msg += "❌ BELUM LULUS UJI OTOMATIS.\n\n";
      }
      if (data.stdout) msg += `[STDOUT]:\n${data.stdout}\n`;
      if (data.error) msg += `[ERROR / ASSERTION]:\n${data.error}\n`;
      outEl.textContent = msg.trim();
    } catch (err) {
      outEl.textContent = `Gagal menjalankan Pyodide di browser.\nDetail: ${err.message}`;
    }
  } else {
    const kws = lab.expected_keywords || [];
    const lower = code.toLowerCase();
    const matched = kws.filter((k) => lower.includes(k.toLowerCase()));
    const missed = kws.filter((k) => !lower.includes(k.toLowerCase()));
    const pass = kws.length === 0 ? code.trim().length > 20 : matched.length >= Math.ceil(kws.length * 0.6);
    if (pass) {
      prog.labPassed[lab.id] = true;
      awardXp(`lab_${c.id}_${lab.id}`, 15);
      saveProgress();
      refreshGamifyUI();
      renderPracticeSidebar();
      const stEl = document.getElementById("lab-detail-status");
      if (stEl) stEl.textContent = "✅ Status: Lulus Uji";
    }
    outEl.textContent =
      `${pass ? "✅ EVALUASI RUBRIK BAIK (+15 XP)" : "⚠ MASIH PERLU DILENGKAPI"} (${matched.length}/${kws.length} kata kunci terdeteksi)\n` +
      `• Konsep tercakup: ${matched.join(", ") || "-"}\n` +
      `• Konsep yang belum muncul: ${missed.join(", ") || "-"}\n\n` +
      `Klik "Lihat Solusi" untuk membandingkan jawaban Anda dengan model lengkap.`;
  }
}

/* STATISTIK & EKSPOR MD */
function computeChapterStats(course) {
  const prog = getCourseProg(course.id);
  const chapters = course.chapters || [];
  const qs = getStageQuestions(course, "all");

  return chapters.map((ch) => {
    const chQs = qs.filter((q) => q.bab === ch.bab);
    const answered = chQs.filter((q) => getAnswer(prog, q) !== undefined);
    const correct = answered.filter((q) => getAnswer(prog, q) === q.answer_index);
    const wrong = answered.filter((q) => getAnswer(prog, q) !== q.answer_index);
    const acc = answered.length ? Math.round((correct.length / answered.length) * 100) : null;
    let status = "Belum Diuji";
    if (acc !== null) {
      if (acc >= 80) status = "Kuasai";
      else if (acc >= 60) status = "Perlu Review";
      else status = "Kritis — Wajib Diulang";
    }
    return {
      bab: ch.bab,
      title: ch.title,
      uas_priority: ch.uas_priority,
      mastered_manual: !!prog.mastered[ch.bab],
      total_q: chQs.length,
      answered: answered.length,
      correct: correct.length,
      wrong_items: wrong,
      acc,
      status,
      note: prog.notes[ch.bab] || "",
    };
  });
}

function buildDiagnosticMarkdown(course) {
  const prog = getCourseProg(course.id);
  const stats = computeChapterStats(course);
  const qs = getStageQuestions(course, "all");
  const totalAns = qs.filter((q) => getAnswer(prog, q) !== undefined).length;
  const totalCorrect = qs.filter((q) => getAnswer(prog, q) === q.answer_index).length;
  const overallAcc = totalAns ? Math.round((totalCorrect / totalAns) * 100) : 0;

  const labs = course.practice_labs || [];
  const labsPassed = labs.filter((l) => prog.labPassed[l.id]).length;
  const nowStr = new Date().toLocaleString("id-ID");

  const prioWeight = { "Sangat Tinggi": 3, "Tinggi": 2, "Sedang": 1 };
  const needReview = stats
    .filter((s) => (s.acc !== null && s.acc < 80) || (!s.mastered_manual && s.uas_priority === "Sangat Tinggi"))
    .sort((a, b) => {
      const accA = a.acc === null ? 50 : a.acc;
      const accB = b.acc === null ? 50 : b.acc;
      if (accA !== accB) return accA - accB;
      return (prioWeight[b.uas_priority] || 1) - (prioWeight[a.uas_priority] || 1);
    });

  let md = `# Laporan Analisis Sesi Belajar & Diagnostik UAS\n\n`;
  md += `- **Mata Kuliah**: ${course.title} (\`${course.code}\`)\n`;
  md += `- **Semester**: Semester ${course.semester}\n`;
  md += `- **Waktu Ekspor**: ${nowStr}\n`;
  md += `- **Skor Soal**: ${totalCorrect} / ${totalAns} dijawab (Total bank soal: ${qs.length}) — **Akurasi: ${overallAcc}%**\n`;
  md += `- **Lab Praktek Selesai**: ${labsPassed} / ${labs.length}\n\n`;

  md += `## 1. Peta Penguasaan Per Bab / Sesi\n\n`;
  md += `| Bab | Judul | Prioritas UAS | Dijawab | Benar | Akurasi | Status | Ditandai Paham |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :---: |\n`;
  for (const s of stats) {
    md += `| ${s.bab} | ${s.title} | ${s.uas_priority} | ${s.answered}/${s.total_q} | ${s.correct} | ${s.acc !== null ? s.acc + "%" : "-"} | ${s.status} | ${s.mastered_manual ? "Ya" : "Belum"} |\n`;
  }

  md += `\n## 2. Bagian yang Belum Dipahami & Wajib Diulang (Prioritas UAS)\n\n`;
  if (!needReview.length) {
    md += `Semua bab yang telah diuji mencapai akurasi >= 80%. Pertahankan dengan latihan soal acak dan cek bagian *Tambahan UAS*.\n\n`;
  } else {
    needReview.forEach((s, i) => {
      md += `### ${i + 1}. ${s.bab}: ${s.title} (Prioritas UAS: ${s.uas_priority})\n`;
      md += `- **Status**: ${s.status} ${s.acc !== null ? `(Akurasi ${s.acc}%)` : "(Belum ditandai paham)"}\n`;
      if (s.wrong_items.length) {
        const subtopics = [...new Set(s.wrong_items.map((w) => w.remedial_section || w.bab))];
        md += `- **Subtopik Spesifik untuk Diulang**:\n`;
        subtopics.forEach((st) => { md += `  - ${st}\n`; });
      } else {
        md += `- **Rekomendasi**: Baca ulang poin inti & rumus kunci pada modul ${s.bab}, lalu kerjakan seluruh soal bab ini.\n`;
      }
      if (s.note) md += `- **Catatan Pribadi Anda**: ${s.note}\n`;
      md += `\n`;
    });
  }

  const allWrong = qs.filter((q) => {
    const ch = getAnswer(prog, q);
    return ch !== undefined && ch !== q.answer_index;
  });
  md += `## 3. Daftar Soal Salah & Remedial (${allWrong.length} Soal)\n\n`;
  if (!allWrong.length) {
    md += `Belum ada soal salah yang tercatat pada sesi ini.\n\n`;
  } else {
    const letters = ["A", "B", "C", "D"];
    allWrong.forEach((q) => {
      const chosenIdx = getAnswer(prog, q);
      md += `- **Soal #${q.id} (${q.bab} | UAS: ${q.uas_priority})**: ${q.question}\n`;
      md += `  - Jawaban Anda: **${letters[chosenIdx]}** (${q.options[chosenIdx]})\n`;
      md += `  - Kunci Benar: **${letters[q.answer_index]}** (${q.options[q.answer_index]})\n`;
      md += `  - Remedial: *${q.remedial_section || q.bab}*\n`;
      md += `  - Ringkasan Pembahasan: ${q.explanation}\n\n`;
    });
  }

  const unpassedLabs = labs.filter((l) => !prog.labPassed[l.id]);
  md += `## 4. Status Lab Praktek / Live Coding\n\n`;
  md += `- Selesai: **${labsPassed}** | Belum Selesai: **${unpassedLabs.length}**\n`;
  if (unpassedLabs.length) {
    md += `- Lab yang perlu diselesaikan:\n`;
    unpassedLabs.forEach((l) => { md += `  - Lab #${l.id} (${l.bab}): ${l.title}\n`; });
  }

  md += `\n## 5. Rencana Aksi Menjelang UAS\n`;
  md += `1. Ulangi materi pada daftar *Bagian yang Belum Dipahami* di atas mulai dari prioritas \`Sangat Tinggi\`.\n`;
  md += `2. Buka tab **Tambahan UAS** dan **Cheat Sheet** pada portal untuk memastikan tidak ada materi BMP yang terlewat.\n`;
  md += `3. Gunakan filter **Remedial (Salah)** di Simulasi Soal hingga seluruh soal remedial terjawab benar.\n`;
  return md;
}

function renderAnalyticsTab() {
  const c = state.activeCourse;
  if (!c) return;
  const stats = computeChapterStats(c);
  const tableHtml = `
    <div class="markdown-body">
      <table>
        <thead>
          <tr><th>Bab</th><th>UAS</th><th>Skor</th><th>Akurasi</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${stats
            .map(
              (s) => `
            <tr>
              <td><strong>${escHtml(s.bab)}</strong><br><small style="color:var(--text-muted)">${escHtml(s.title)}</small></td>
              <td><span class="prio-badge ${prioClass(s.uas_priority)}">${escHtml(s.uas_priority)}</span></td>
              <td>${s.correct}/${s.answered}</td>
              <td>${s.acc !== null ? `<strong>${s.acc}%</strong>` : "-"}</td>
              <td>${escHtml(s.status)}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
  document.getElementById("analytics-chapter-table").innerHTML = tableHtml;
  document.getElementById("md-preview-box").value = buildDiagnosticMarkdown(c);
  document.getElementById("save-status-msg").textContent = "";
}

function saveSessionToLocalHistory() {
  const c = state.activeCourse;
  if (!c) return;
  const content = document.getElementById("md-preview-box").value;
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `analisis_sesi_${c.id}_${ts}.md`;
  const reports = getSavedReports();
  reports.unshift({
    filename,
    courseTitle: c.title,
    modified: new Date().toLocaleString("id-ID"),
    size_bytes: new Blob([content]).size,
    content,
  });
  if (reports.length > 20) reports.length = 20;
  saveProgress();
  refreshSessionsCount();
  document.getElementById("save-status-msg").textContent = `✓ Tersimpan di riwayat browser (${filename}).`;
}

function downloadSessionMd() {
  const c = state.activeCourse;
  if (!c) return;
  const content = document.getElementById("md-preview-box").value;
  const ts = new Date().toISOString().slice(0, 10);
  const filename = `analisis_sesi_${c.id}_${ts}.md`;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  document.getElementById("save-status-msg").textContent = `✓ File ${filename} berhasil diunduh.`;
}

function refreshSessionsCount() {
  const reports = getSavedReports();
  document.getElementById("session-count-badge").textContent = reports.length;
}

function openSessionsModal() {
  const modal = document.getElementById("sessions-modal");
  const body = document.getElementById("sessions-modal-body");
  modal.style.display = "grid";
  const sessions = getSavedReports();
  if (!sessions.length) {
    body.innerHTML = `<div class="empty-state"><h4>Belum ada laporan tersimpan</h4><p>Buka tab <strong>Statistik</strong> lalu klik <strong>Simpan Riwayat</strong> atau <strong>Unduh .md</strong>.</p></div>`;
    return;
  }
  body.innerHTML = sessions
    .map(
      (s, i) => `
    <div class="session-row">
      <div class="row-between">
        <div>
          <strong>${escHtml(s.filename)}</strong>
          <div class="muted">${escHtml(s.courseTitle || "")} • ${escHtml(s.modified)} • ${s.size_bytes} bytes</div>
        </div>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" data-sidx="${i}">Lihat Isi</button>
          <button class="btn btn-primary btn-sm" data-dlidx="${i}">⬇ Unduh</button>
        </div>
      </div>
      <pre id="sess-content-${i}" class="readonly-code" style="display:none;max-height:300px;overflow:auto;white-space:pre-wrap;">${escHtml(s.content)}</pre>
    </div>`
    )
    .join("");
  body.querySelectorAll("button[data-sidx]").forEach((b) => {
    b.addEventListener("click", () => {
      const el = document.getElementById(`sess-content-${b.dataset.sidx}`);
      el.style.display = el.style.display === "none" ? "block" : "none";
    });
  });
  body.querySelectorAll("button[data-dlidx]").forEach((b) => {
    b.addEventListener("click", () => {
      const s = sessions[Number(b.dataset.dlidx)];
      const blob = new Blob([s.content], { type: "text/markdown;charset=utf-8" });
      const a = document.createElement("a");
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = s.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initPwaControls();
  init();
});
