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
  quizMode: "instant", // instant | random | remedial | exam
  examActive: false,
  examSubmitted: false,
  examSecondsLeft: 3600,
  examTotalSeconds: 3600,
  examTimerHandle: null,
  examQuestions: [],
  examAnswers: {},
  fcList: [],
  fcIdx: 0,
  activeLabIdx: 0,
  sandboxMode: false,
  activeSearchHighlight: "",
  gsScope: "all",
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
      bookmarked: {},
      mastered: {},
      notes: {},
      questionNotes: {},
      flashcards: {},
      labPassed: {},
      labCode: {},
      lastState: {},
    };
  }
  const p = state.progress[courseId];
  if (!p.bookmarked) p.bookmarked = {};
  if (!p.questionNotes) p.questionNotes = {};
  if (!p.flashcards) p.flashcards = {};
  if (!p.lastState) p.lastState = {};
  return p;
}

function getGamify() {
  if (!state.progress.__gamify) {
    state.progress.__gamify = {
      xp: 0,
      awardedKeys: {},
      correctRun: 0,
      maxCorrectRun: 0,
      dailyStreak: 1,
      dailyTarget: 15,
      dailyLog: {},
      lastDate: "",
      badges: {},
      stageCelebrated: {},
    };
  }
  const g = state.progress.__gamify;
  if (!g.dailyTarget) g.dailyTarget = 15;
  if (!g.dailyLog) g.dailyLog = {};
  return g;
}

function getSavedReports() {
  if (!Array.isArray(state.progress.__savedReports)) {
    state.progress.__savedReports = [];
  }
  return state.progress.__savedReports;
}

function getStudySessions() {
  if (!Array.isArray(state.progress.__studySessions)) {
    state.progress.__studySessions = [];
  }
  return state.progress.__studySessions;
}

function getTodayDateKey() {
  try {
    return new Date().toLocaleDateString("en-CA");
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function getTodayActivityCount() {
  const g = getGamify();
  const today = getTodayDateKey();
  return (g.dailyLog[today] && g.dailyLog[today].total) || 0;
}

function recordDailyActivity(kind, courseObj = null, detailLabel = "") {
  const g = getGamify();
  const today = getTodayDateKey();
  if (!g.dailyLog[today]) {
    g.dailyLog[today] = { questions: 0, labs: 0, chapters: 0, flashcards: 0, total: 0 };
  }
  g.dailyLog[today][kind] = (g.dailyLog[today][kind] || 0) + 1;
  g.dailyLog[today].total = (g.dailyLog[today].total || 0) + 1;

  if (courseObj) {
    const sessions = getStudySessions();
    const existing = sessions.find((s) => s.dateKey === today && s.courseId === courseObj.id && s.mode === "Latihan Harian");
    if (existing) {
      existing.count = (existing.count || 1) + 1;
      existing.modified = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      if (detailLabel) existing.detail = detailLabel;
    } else {
      sessions.unshift({
        dateKey: today,
        modified: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        courseId: courseObj.id,
        courseTitle: courseObj.title.split("(")[0].trim(),
        mode: "Latihan Harian",
        score: "-",
        detail: detailLabel || "Aktivitas belajar harian",
        count: 1,
      });
      if (sessions.length > 40) sessions.length = 40;
    }
  }

  saveProgress();
  renderDailyReminderBanner();
}

function recordStudySession(entry) {
  const sessions = getStudySessions();
  sessions.unshift({
    dateKey: getTodayDateKey(),
    modified: new Date().toLocaleString("id-ID"),
    courseId: entry.courseId,
    courseTitle: entry.courseTitle,
    mode: entry.mode,
    score: entry.score || "-",
    detail: entry.detail || "",
    count: entry.count || 1,
  });
  if (sessions.length > 40) sessions.length = 40;
  saveProgress();
}

function renderDailyReminderBanner() {
  const banner = document.getElementById("daily-reminder-banner");
  if (!banner) return;
  const g = getGamify();
  const today = getTodayDateKey();
  const todayCount = getTodayActivityCount();

  if (todayCount > 0 || state.progress.__dismissedReminderDate === today) {
    banner.style.display = "none";
    return;
  }

  const desc = document.getElementById("reminder-desc");
  if (desc) {
    desc.textContent = `Target harian Anda: 0 / ${g.dailyTarget} aktivitas. Luangkan 5 menit hari ini agar streak ${g.dailyStreak} hari tetap terjaga!`;
  }
  banner.style.display = "flex";
}

function getLastCourseId() {
  return (state.progress.__lastPosition && state.progress.__lastPosition.courseId) || state.progress.__lastCourseId || null;
}

function getLastPosition() {
  return state.progress.__lastPosition || null;
}

function setLastCourseId(cid) {
  state.progress.__lastCourseId = cid;
  saveProgress();
}

function saveLastPosition(overrides = {}) {
  if (!state.activeCourse) return;
  const c = state.activeCourse;
  const prog = getCourseProg(c.id);
  const currentQ = state.filteredQuestions[state.activeQIdx];
  const qKey = overrides.qKey !== undefined ? overrides.qKey : (currentQ ? currentQ._key : prog.lastState.qKey || null);
  const babSel = document.getElementById("quiz-filter-bab");
  const pos = {
    courseId: c.id,
    section: overrides.section || (state.activeSection === "beranda" || state.activeSection === "pengaturan" ? "belajar" : state.activeSection),
    belajarTab: overrides.belajarTab || state.activeBelajarTab,
    latihanTab: overrides.latihanTab || state.activeLatihanTab,
    chapterIdx: overrides.chapterIdx !== undefined ? overrides.chapterIdx : state.activeChapterIdx,
    stage: overrides.stage || state.activeStage,
    babFilter: overrides.babFilter !== undefined ? overrides.babFilter : (babSel ? babSel.value : "all"),
    quizMode: overrides.quizMode || state.quizMode,
    qKey,
    labIdx: overrides.labIdx !== undefined ? overrides.labIdx : state.activeLabIdx,
    timestamp: Date.now(),
  };
  prog.lastState = {
    chapterIdx: pos.chapterIdx,
    stage: pos.stage,
    babFilter: pos.babFilter,
    quizMode: pos.quizMode,
    qKey: pos.qKey,
    labIdx: pos.labIdx,
    belajarTab: pos.belajarTab,
    latihanTab: pos.latihanTab,
  };
  state.progress.__lastCourseId = c.id;
  state.progress.__lastPosition = pos;
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
  const today = getTodayDateKey();
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
      if (swEl) swEl.textContent = reg.active ? "Aktif (portal-v6 siap offline)" : "Terdaftar";
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

function isBookmarkedQ(prog, q) {
  return !!(prog.bookmarked && prog.bookmarked[q._key]);
}

function toggleBookmarkQ(prog, q) {
  if (!prog.bookmarked) prog.bookmarked = {};
  prog.bookmarked[q._key] = !prog.bookmarked[q._key];
}

function getQuestionNote(prog, q) {
  return (prog.questionNotes && prog.questionNotes[q._key]) || "";
}

function setQuestionNote(prog, q, text) {
  if (!prog.questionNotes) prog.questionNotes = {};
  if (text.trim()) prog.questionNotes[q._key] = text;
  else delete prog.questionNotes[q._key];
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
      restoreCourseState(state.coursesCache[defaultId], { preservePosition: true });
    }
    renderDashboard();
    renderDailyReminderBanner();
    refreshGamifyUI();
    refreshSessionsCount();
  } catch (err) {
    document.getElementById("course-grid").innerHTML = `<div class="empty-state"><h4>Gagal Memuat Data</h4><p>Pastikan aplikasi dibuka lewat server statis atau GitHub Pages. (${escHtml(err.message)})</p></div>`;
  }
}

/* Navigation between 5 main sections */
function navigateTo(sectionName, opts = {}) {
  state.activeSection = sectionName;
  document.querySelectorAll(".page-section").forEach((s) => {
    s.classList.toggle("active", s.id === `sec-${sectionName}`);
  });
  document.querySelectorAll(".nav-item, .bnav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.nav === sectionName);
  });

  if (sectionName === "beranda") {
    state.activeSearchHighlight = "";
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
    if (!opts.skipSave && (sectionName === "belajar" || sectionName === "latihan")) {
      saveLastPosition({ section: sectionName });
    }
  }
  if (!opts.skipScroll) {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function bindGlobalEvents() {
  document.querySelectorAll(".nav-item, .bnav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeSearchHighlight = "";
      navigateTo(btn.dataset.nav);
    });
  });

  document.getElementById("btn-brand-home").addEventListener("click", () => navigateTo("beranda"));
  document.getElementById("mobile-brand-btn").addEventListener("click", () => navigateTo("beranda"));

  document.getElementById("btn-resume-last").addEventListener("click", () => {
    const last = getLastPosition();
    const lastId = (last && last.courseId) || getLastCourseId();
    if (lastId && state.coursesCache[lastId]) {
      openCourse(lastId, (last && last.section) || "belajar", {
        preservePosition: true,
        belajarTab: last && last.belajarTab,
        latihanTab: last && last.latihanTab,
        chapterIdx: last && last.chapterIdx,
        stage: last && last.stage,
        babFilter: last && last.babFilter,
        quizMode: last && last.quizMode,
        qKey: last && last.qKey,
        labIdx: last && last.labIdx,
      });
    }
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
    saveLastPosition();
  });

  ["quiz-filter-bab", "quiz-filter-priority", "quiz-filter-status"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      applyQuizFilters(true);
      saveLastPosition();
    });
  });

  document.getElementById("btn-focus-uas").addEventListener("click", () => {
    const sel = document.getElementById("quiz-filter-priority");
    sel.value = sel.value === "Sangat Tinggi" ? "all" : "Sangat Tinggi";
    applyQuizFilters(true);
    saveLastPosition();
  });

  document.getElementById("btn-toggle-qgrid").addEventListener("click", () => {
    const drawer = document.getElementById("quiz-navigator-drawer");
    const isOpen = drawer.classList.toggle("open");
    if (isOpen) renderQuestionGrid();
  });

  document.getElementById("quiz-mode").addEventListener("change", (e) => {
    state.quizMode = e.target.value;
    if (state.quizMode === "remedial" && state.activeCourse) {
      // Ensure remedial finds wrong questions across all stages if current stage has none
      const curWrong = getStageQuestions(state.activeCourse, state.activeStage).filter((q) => {
        const ch = getAnswer(getCourseProg(state.activeCourse.id), q);
        return ch !== undefined && ch !== q.answer_index;
      });
      if (!curWrong.length && document.getElementById("quiz-filter-stage").querySelector('option[value="all"]')) {
        state.activeStage = "all";
        document.getElementById("quiz-filter-stage").value = "all";
        populateQuizBabDropdown();
      }
    }
    syncQuizModeUI();
    applyQuizFilters(true);
    saveLastPosition();
  });

  document.getElementById("btn-reshuffle-q").addEventListener("click", () => {
    state.filteredQuestions = shuffleArray(state.filteredQuestions);
    state.activeQIdx = 0;
    renderCurrentQuestion();
    renderQuestionGrid();
  });

  document.getElementById("exam-duration-select").addEventListener("change", () => {
    if (!state.examActive) {
      const mins = Number(document.getElementById("exam-duration-select").value) || 60;
      state.examSecondsLeft = mins * 60;
      state.examTotalSeconds = state.examSecondsLeft;
      updateExamTimerUI();
    }
  });

  document.getElementById("btn-start-exam").addEventListener("click", () => {
    if (!state.examActive) {
      startNewExamSimulation();
    } else {
      finishExam();
    }
    renderCurrentQuestion();
    renderQuestionGrid();
  });

  document.getElementById("btn-reset-quiz").addEventListener("click", () => {
    if (!state.activeCourse) return;
    if (!confirm("Reset semua jawaban soal pada mata kuliah ini?")) return;
    const p = getCourseProg(state.activeCourse.id);
    p.answers = {};
    p.flagged = {};
    state.examActive = false;
    state.examSubmitted = false;
    state.examQuestions = [];
    state.examAnswers = {};
    stopExamTimer();
    syncQuizModeUI();
    saveProgress();
    applyQuizFilters(true);
    updateCourseTopbar();
  });

  document.getElementById("btn-prev-q").addEventListener("click", () => {
    if (state.activeQIdx > 0) {
      state.activeQIdx--;
      renderCurrentQuestion();
      renderQuestionGrid();
      saveLastPosition();
    }
  });
  document.getElementById("btn-next-q").addEventListener("click", () => {
    if (state.activeQIdx < state.filteredQuestions.length - 1) {
      state.activeQIdx++;
      renderCurrentQuestion();
      renderQuestionGrid();
      saveLastPosition();
    }
  });

  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openGlobalSearchModal();
      return;
    }
    if (e.key === "Escape") {
      const gs = document.getElementById("global-search-modal");
      const sm = document.getElementById("sessions-modal");
      if (gs && gs.style.display !== "none") { closeGlobalSearchModal(); return; }
      if (sm && sm.style.display !== "none") { sm.style.display = "none"; return; }
    }
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
    } else if (k === "b") {
      const bb = document.getElementById("btn-bookmark-q");
      if (bb) bb.click();
    }
  });

  // Flashcard controls + spaced repetition
  document.getElementById("flashcard-box").addEventListener("click", () => {
    document.getElementById("flashcard-box").classList.toggle("flipped");
  });
  document.getElementById("fc-bab-filter").addEventListener("change", buildFlashcardList);
  document.getElementById("fc-mode-filter").addEventListener("change", buildFlashcardList);
  document.getElementById("btn-fc-shuffle").addEventListener("click", () => {
    state.fcList = shuffleArray(state.fcList);
    state.fcIdx = 0;
    renderFlashcard();
  });
  document.getElementById("btn-fc-mark-belum").addEventListener("click", () => rateCurrentFlashcard("belum"));
  document.getElementById("btn-fc-mark-hafal").addEventListener("click", () => rateCurrentFlashcard("hafal"));
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

  // Reminder banner & daily target
  document.getElementById("btn-reminder-start").addEventListener("click", () => {
    const last = getLastPosition();
    const targetId = (last && last.courseId && state.coursesCache[last.courseId]) ? last.courseId : (state.activeCourse?.id || state.index[0]?.id);
    if (targetId) {
      openCourse(targetId, (last && last.section) || "latihan", { preservePosition: true });
    }
  });
  document.getElementById("btn-reminder-dismiss").addEventListener("click", () => {
    state.progress.__dismissedReminderDate = getTodayDateKey();
    saveProgress();
    renderDailyReminderBanner();
  });
  document.getElementById("stat-daily-target").addEventListener("change", (e) => {
    const g = getGamify();
    g.dailyTarget = Number(e.target.value) || 15;
    saveProgress();
    renderAnalyticsTab();
    renderDailyReminderBanner();
  });

  // Settings backup (Ekspor + Impor JSON) & reset
  document.getElementById("btn-export-backup-json").addEventListener("click", () => {
    const payload = {
      app: "portal-belajar-sains-data",
      schema_version: 2,
      exported_at: new Date().toISOString(),
      theme_pref: getThemePref(),
      progress: state.progress,
    };
    const filename = `cadangan_progres_portal_${getTodayDateKey()}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const msgEl = document.getElementById("backup-status-msg");
    if (msgEl) msgEl.textContent = `✓ Cadangan lengkap diekspor (${filename}).`;
  });

  const importBtn = document.getElementById("btn-import-backup-json");
  const importInput = document.getElementById("input-import-backup-json");
  if (importBtn && importInput) {
    importBtn.addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      const msgEl = document.getElementById("backup-status-msg");
      if (!file) return;
      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);
        let importedProg = null;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          if (parsed.app === "portal-belajar-sains-data" && parsed.progress && typeof parsed.progress === "object") {
            importedProg = parsed.progress;
            if (parsed.theme_pref) applyTheme(parsed.theme_pref);
          } else if (parsed.__gamify || parsed.__lastCourseId || parsed.__lastPosition || Object.keys(parsed).some((k) => state.index.some((item) => item.id === k))) {
            importedProg = parsed;
          }
        }
        if (!importedProg || Array.isArray(importedProg)) {
          throw new Error("Struktur JSON bukan cadangan Portal Belajar Sains Data.");
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(importedProg));
        state.progress = loadProgress();
        touchDailyStreak();
        if (state.activeCourse) {
          restoreCourseState(state.activeCourse, { preservePosition: true });
        }
        refreshGamifyUI();
        refreshSessionsCount();
        renderDashboard();
        renderDailyReminderBanner();
        if (state.activeSection === "statistik") renderAnalyticsTab();
        const xp = getGamify().xp || 0;
        if (msgEl) msgEl.textContent = `✅ Cadangan berhasil dipulihkan dari ${file.name} (Total XP: ${xp}).`;
      } catch (err) {
        if (msgEl) msgEl.textContent = `❌ Gagal mengimpor cadangan JSON: ${err.message}`;
      } finally {
        importInput.value = "";
      }
    });
  }

  document.getElementById("btn-reset-all-progress").addEventListener("click", () => {
    if (!confirm("Hapus seluruh progres belajar, skor, catatan, bookmark, flashcard, dan XP di browser ini?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state.progress = loadProgress();
    touchDailyStreak();
    refreshGamifyUI();
    refreshSessionsCount();
    renderDashboard();
    renderDailyReminderBanner();
    const msgEl = document.getElementById("backup-status-msg");
    if (msgEl) msgEl.textContent = "Semua progres lokal direset.";
  });

  // Modals (Sessions & Global Search)
  document.getElementById("btn-sessions-modal").addEventListener("click", openSessionsModal);
  document.getElementById("btn-close-modal").addEventListener("click", () => {
    document.getElementById("sessions-modal").style.display = "none";
  });
  document.querySelector("#sessions-modal .modal-backdrop").addEventListener("click", () => {
    document.getElementById("sessions-modal").style.display = "none";
  });

  document.getElementById("btn-global-search").addEventListener("click", openGlobalSearchModal);
  document.getElementById("btn-close-gs").addEventListener("click", closeGlobalSearchModal);
  document.getElementById("gs-backdrop").addEventListener("click", closeGlobalSearchModal);
  document.getElementById("global-search-input").addEventListener("input", runGlobalSearch);
  document.getElementById("gs-current-only").addEventListener("change", runGlobalSearch);
  document.querySelectorAll("#gs-scope-tabs .pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#gs-scope-tabs .pill").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.gsScope = btn.dataset.gsType;
      runGlobalSearch();
    });
  });
}

function switchBelajarTab(subtabId, skipSave = false) {
  state.activeBelajarTab = subtabId;
  document.querySelectorAll("#sec-belajar .subtab-btn").forEach((b) => b.classList.toggle("active", b.dataset.subtab === subtabId));
  document.querySelectorAll("#sec-belajar .subtab-panel").forEach((p) => p.classList.toggle("active", p.id === `subtab-${subtabId}`));
  if (subtabId === "flashcard") renderFlashcard();
  if (!skipSave) saveLastPosition({ belajarTab: subtabId });
}

function switchLatihanTab(subtabId, skipSave = false) {
  state.activeLatihanTab = subtabId;
  document.querySelectorAll("#sec-latihan .subtab-btn").forEach((b) => b.classList.toggle("active", b.dataset.subtab === subtabId));
  document.querySelectorAll("#sec-latihan .subtab-panel").forEach((p) => p.classList.toggle("active", p.id === `subtab-${subtabId}`));
  if (!skipSave) saveLastPosition({ latihanTab: subtabId });
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

  const lastPos = getLastPosition();
  const lastId = (lastPos && lastPos.courseId) || getLastCourseId();
  const resumeBtn = document.getElementById("btn-resume-last");
  if (lastId && state.coursesCache[lastId]) {
    const courseObj = state.coursesCache[lastId];
    const shortTitle = courseObj.title.split("(")[0].trim();
    let detail = "";
    if (lastPos && lastPos.courseId === lastId) {
      if (lastPos.section === "latihan") {
        if (lastPos.latihanTab === "practice") detail = ` — Lab #${(lastPos.labIdx || 0) + 1}`;
        else if (lastPos.qKey) detail = ` — Soal ${String(lastPos.qKey).replace(/^s(\d+)_/, "T$1 #")}`;
        else detail = " — Latihan Soal";
      } else {
        const ch = (courseObj.chapters || [])[lastPos.chapterIdx || 0];
        if (ch) detail = ` — ${ch.bab}`;
      }
    }
    resumeBtn.style.display = "inline-flex";
    resumeBtn.textContent = `▶ Lanjut: ${shortTitle}${detail}`;
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

function restoreCourseState(course, opts = {}) {
  const prog = getCourseProg(course.id);
  const saved = prog.lastState || {};
  const preserve = opts.preservePosition !== false;
  state.activeCourse = course;
  const maxChap = Math.max(0, (course.chapters || []).length - 1);
  state.activeChapterIdx = opts.chapterIdx !== undefined
    ? Math.min(maxChap, Math.max(0, Number(opts.chapterIdx) || 0))
    : (preserve && saved.chapterIdx !== undefined ? Math.min(maxChap, Number(saved.chapterIdx) || 0) : 0);
  const maxLab = Math.max(0, (course.practice_labs || []).length - 1);
  state.activeLabIdx = opts.labIdx !== undefined
    ? Math.min(maxLab, Math.max(0, Number(opts.labIdx) || 0))
    : (preserve && saved.labIdx !== undefined ? Math.min(maxLab, Number(saved.labIdx) || 0) : 0);
  state.sandboxMode = false;
  state.examActive = false;
  state.examSubmitted = false;
  state.examQuestions = [];
  state.examAnswers = {};
  stopExamTimer();

  syncActiveCourseViews({
    stage: opts.stage || (preserve ? saved.stage : undefined),
    babFilter: opts.babFilter || (preserve ? saved.babFilter : undefined),
    quizMode: opts.quizMode || (preserve ? saved.quizMode : undefined),
    qKey: opts.qKey || (preserve ? saved.qKey : undefined),
  });
  if (opts.belajarTab) switchBelajarTab(opts.belajarTab, true);
  if (opts.latihanTab) switchLatihanTab(opts.latihanTab, true);
}

function syncActiveCourseViews(quizRestoreOpts = {}) {
  if (!state.activeCourse) return;
  updateCourseTopbar();
  renderCourseSwitchers();
  renderChapterSidebar();
  renderChapterDetail();
  renderUasGaps();
  renderCheatSheet();
  initQuizFilters(quizRestoreOpts);
  initFlashcardFilters();
  renderPracticeSidebar();
  renderPracticeStage();
}

async function openCourse(courseId, targetSection = "belajar", opts = {}) {
  let course = state.coursesCache[courseId];
  if (!course) {
    const meta = state.index.find((x) => x.id === courseId);
    const r = await fetch(meta.file);
    course = await r.json();
    state.coursesCache[courseId] = course;
  }
  if (!opts.keepHighlight) state.activeSearchHighlight = "";
  document.getElementById("quiz-navigator-drawer")?.classList.remove("open");
  restoreCourseState(course, opts);
  setLastCourseId(courseId);
  navigateTo(targetSection, { skipScroll: opts.skipScroll });
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
      state.activeSearchHighlight = "";
      state.activeChapterIdx = Number(el.dataset.idx);
      saveLastPosition({ chapterIdx: state.activeChapterIdx, section: "belajar", belajarTab: "modul" });
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
      <div class="q-note-head">
        <label for="chapter-note-input">📝 Catatan Belajar Pribadi (${escHtml(ch.bab)})</label>
        <span class="muted" id="chapter-note-save-status" style="font-size:12px;">${noteVal ? "✓ Tersimpan di browser" : ""}</span>
      </div>
      <textarea id="chapter-note-input" placeholder="Tulis poin yang masih membingungkan atau trik cepat Anda di sini...">${escHtml(noteVal)}</textarea>
    </div>
  `;

  applyMath(card);
  highlightAndScrollIfActive(card);

  document.getElementById("btn-toggle-mastered").addEventListener("click", () => {
    prog.mastered[ch.bab] = !prog.mastered[ch.bab];
    if (prog.mastered[ch.bab]) {
      awardXp(`bab_${c.id}_${ch.bab}`, 20);
      recordDailyActivity("chapters", c, `Paham ${ch.bab}`);
    } else {
      saveProgress();
    }
    refreshGamifyUI();
    renderChapterSidebar();
    renderChapterDetail();
  });

  document.getElementById("btn-practice-this-bab").addEventListener("click", () => {
    state.activeSearchHighlight = "";
    state.quizMode = "instant";
    document.getElementById("quiz-mode").value = "instant";
    syncQuizModeUI();
    document.getElementById("quiz-filter-bab").value = ch.bab;
    applyQuizFilters(true);
    switchLatihanTab("quiz");
    navigateTo("latihan");
  });

  document.getElementById("chapter-note-input").addEventListener("input", (e) => {
    prog.notes[ch.bab] = e.target.value;
    saveProgress();
    const st = document.getElementById("chapter-note-save-status");
    if (st) st.textContent = e.target.value.trim() ? "✓ Tersimpan otomatis" : "";
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
  highlightAndScrollIfActive(wrap);
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
function syncQuizModeUI() {
  const isExam = state.quizMode === "exam";
  const isRandom = state.quizMode === "random";
  const cfg = document.getElementById("exam-config-bar");
  const timer = document.getElementById("exam-timer");
  const startBtn = document.getElementById("btn-start-exam");
  const reshuffleBtn = document.getElementById("btn-reshuffle-q");
  if (cfg) cfg.style.display = isExam ? "flex" : "none";
  if (timer) timer.style.display = isExam ? "inline-flex" : "none";
  if (startBtn) startBtn.style.display = isExam ? "inline-flex" : "none";
  if (reshuffleBtn) reshuffleBtn.style.display = isRandom ? "inline-flex" : "none";

  if (!isExam) {
    stopExamTimer();
    state.examActive = false;
    state.examSubmitted = false;
    state.examQuestions = [];
    state.examAnswers = {};
  } else if (!state.examActive && !state.examSubmitted) {
    const mins = Number(document.getElementById("exam-duration-select")?.value) || 60;
    state.examSecondsLeft = mins * 60;
    state.examTotalSeconds = state.examSecondsLeft;
    if (startBtn) startBtn.textContent = "Mulai Simulasi UAS";
    updateExamTimerUI();
  }
}

function initQuizFilters(restoreOpts = {}) {
  const c = state.activeCourse;
  const stageSel = document.getElementById("quiz-filter-stage");
  const opts = [`<option value="1">Tahap 1 (${(c.questions_stage_1 || []).length} Soal)</option>`];
  if ((c.questions_stage_2 || []).length) opts.push(`<option value="2">Tahap 2 (${c.questions_stage_2.length} Soal)</option>`);
  if ((c.questions_stage_3 || []).length) opts.push(`<option value="3">Tahap 3 (${c.questions_stage_3.length} Soal)</option>`);
  if ((c.questions_stage_2 || []).length || (c.questions_stage_3 || []).length) {
    opts.push(`<option value="all">Semua Tahap (${getStageQuestions(c, "all").length} Soal)</option>`);
  }
  stageSel.innerHTML = opts.join("");
  const targetStage = restoreOpts.stage && stageSel.querySelector(`option[value="${restoreOpts.stage}"]`) ? restoreOpts.stage : "1";
  state.activeStage = targetStage;
  stageSel.value = targetStage;

  populateQuizBabDropdown();
  const babSel = document.getElementById("quiz-filter-bab");
  if (restoreOpts.babFilter && [...babSel.options].some((o) => o.value === restoreOpts.babFilter)) {
    babSel.value = restoreOpts.babFilter;
  }
  document.getElementById("quiz-filter-priority").value = "all";
  document.getElementById("quiz-filter-status").value = "all";

  const modeSel = document.getElementById("quiz-mode");
  const targetMode = restoreOpts.quizMode && restoreOpts.quizMode !== "exam" && modeSel.querySelector(`option[value="${restoreOpts.quizMode}"]`)
    ? restoreOpts.quizMode
    : "instant";
  state.quizMode = targetMode;
  modeSel.value = targetMode;
  syncQuizModeUI();
  applyQuizFilters(true, restoreOpts.qKey || null);
}

function populateQuizBabDropdown() {
  const c = state.activeCourse;
  const qs = getStageQuestions(c, state.activeStage);
  const sel = document.getElementById("quiz-filter-bab");
  const babs = [...new Set(qs.map((q) => q.bab))];
  sel.innerHTML = `<option value="all">Semua Bab (${qs.length})</option>` +
    babs.map((b) => `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join("");
}

function getQuizFilteredPool() {
  const c = state.activeCourse;
  const prog = getCourseProg(c.id);
  const bab = document.getElementById("quiz-filter-bab").value;
  const prio = document.getElementById("quiz-filter-priority").value;
  const status = document.getElementById("quiz-filter-status").value;

  return getStageQuestions(c, state.activeStage).filter((q) => {
    if (bab !== "all" && q.bab !== bab) return false;
    if (prio !== "all" && q.uas_priority !== prio) return false;
    const chosen = getAnswer(prog, q);
    if (state.quizMode === "remedial") {
      if (chosen === undefined || chosen === q.answer_index) return false;
    }
    if (status === "unanswered" && chosen !== undefined) return false;
    if (status === "wrong" && (chosen === undefined || chosen === q.answer_index)) return false;
    if (status === "flagged" && !isFlaggedQ(prog, q)) return false;
    if (status === "bookmarked" && !isBookmarkedQ(prog, q)) return false;
    return true;
  });
}

function applyQuizFilters(resetIndex = false, targetQKey = null) {
  if (state.quizMode === "exam" && (state.examActive || state.examSubmitted) && state.examQuestions.length) {
    state.filteredQuestions = state.examQuestions;
  } else {
    let pool = getQuizFilteredPool();
    if (state.quizMode === "random") {
      pool = shuffleArray(pool);
    }
    state.filteredQuestions = pool;
  }

  if (targetQKey) {
    const foundIdx = state.filteredQuestions.findIndex((q) => q._key === targetQKey);
    state.activeQIdx = foundIdx >= 0 ? foundIdx : 0;
  } else if (resetIndex || state.activeQIdx >= state.filteredQuestions.length) {
    state.activeQIdx = 0;
  }
  renderCurrentQuestion();
  renderQuestionGrid();
}

function startNewExamSimulation() {
  const pool = getQuizFilteredPool();
  const basePool = pool.length ? pool : getStageQuestions(state.activeCourse, state.activeStage);
  const countVal = document.getElementById("exam-count-select").value;
  const shuffled = shuffleArray(basePool);
  const count = countVal === "all" ? shuffled.length : Math.min(shuffled.length, Number(countVal) || 50);
  const mins = Number(document.getElementById("exam-duration-select").value) || 60;

  state.examQuestions = shuffled.slice(0, count);
  state.filteredQuestions = state.examQuestions;
  state.examAnswers = {};
  state.examActive = true;
  state.examSubmitted = false;
  state.activeQIdx = 0;
  state.examSecondsLeft = mins * 60;
  state.examTotalSeconds = state.examSecondsLeft;
  document.getElementById("btn-start-exam").textContent = "Selesaikan & Koreksi";
  updateExamTimerUI();
  startExamTimer();
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
    const isRemedial = state.quizMode === "remedial";
    stage.innerHTML = `
      <div class="empty-state">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" style="color:var(--text-muted)"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        <h4>${isRemedial ? "Belum ada soal salah untuk remedial 🎉" : "Tidak ada soal pada filter ini"}</h4>
        <p>${isRemedial ? "Hebat! Belum ada jawaban salah yang tercatat pada filter saat ini, atau seluruh soal remedial sudah diperbaiki." : "Mungkin belum ada soal bookmark/salah atau semua soal pada filter ini sudah selesai dikerjakan."}</p>
        <button class="btn btn-primary" id="btn-reset-q-filters">Tampilkan Semua Soal</button>
      </div>`;
    document.getElementById("q-counter").textContent = "0 / 0";
    document.getElementById("quiz-progress-fill").style.width = "0%";
    document.getElementById("btn-reset-q-filters").addEventListener("click", () => {
      state.quizMode = "instant";
      document.getElementById("quiz-mode").value = "instant";
      syncQuizModeUI();
      document.getElementById("quiz-filter-bab").value = "all";
      document.getElementById("quiz-filter-priority").value = "all";
      document.getElementById("quiz-filter-status").value = "all";
      applyQuizFilters(true);
    });
    return;
  }

  const q = state.filteredQuestions[state.activeQIdx];
  const isExamMode = state.quizMode === "exam";
  const chosen = isExamMode ? state.examAnswers[q._key] : getAnswer(prog, q);
  const isFlagged = isFlaggedQ(prog, q);
  const isBookmarked = isBookmarkedQ(prog, q);
  const qNote = getQuestionNote(prog, q);
  const showCorrection =
    (!isExamMode && chosen !== undefined) ||
    (isExamMode && state.examSubmitted);

  let examSummaryHtml = "";
  if (isExamMode && state.examSubmitted) {
    const examList = state.examQuestions;
    const examRight = examList.filter((item) => state.examAnswers[item._key] === item.answer_index).length;
    const examAns = examList.filter((item) => state.examAnswers[item._key] !== undefined).length;
    const pct = examList.length ? Math.round((examRight / examList.length) * 100) : 0;
    examSummaryHtml = `
      <div class="exam-summary-banner">
        <div class="row-between">
          <div>
            <strong>🎓 Hasil Simulasi UAS Selesai!</strong>
            <div class="muted" style="font-size:13px;">Benar <strong>${examRight}/${examList.length}</strong> (${pct}%) • Dijawab ${examAns}/${examList.length}. Pembahasan kini terbuka di seluruh soal di bawah.</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-exam-goto-stat">📊 Analitik &amp; Ekspor MD</button>
        </div>
      </div>`;
  }

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
    const statusText = chosen === undefined
      ? `⚪ Tidak Dijawab — Kunci: ${letters[q.answer_index]}`
      : isCorrect
        ? "✅ Jawaban Benar! (+10 XP)"
        : `❌ Kurang Tepat — Kunci: ${letters[q.answer_index]}`;
    explHtml = `
      <details class="explanation-details ${isCorrect ? "ok" : "bad"}" open>
        <summary>
          <span>${statusText}</span>
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
  } else if (isExamMode) {
    explHtml = `<div class="muted" style="margin-top:14px;font-size:13px;">⏱ Mode Simulasi UAS: Pembahasan &amp; kunci jawaban akan dibuka otomatis setelah Anda menekan <strong>Selesaikan &amp; Koreksi</strong> atau waktu habis.</div>`;
  }

  stage.innerHTML = `
    ${examSummaryHtml}
    <div class="q-header">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <span class="c-badge pastel" style="background:var(--baby-blue);color:var(--baby-blue-ink);">Soal #${q.id}</span>
        <span class="c-badge">${escHtml(q.bab)}</span>
        <span class="prio-badge ${prioClass(q.uas_priority)}">UAS: ${escHtml(q.uas_priority)}</span>
      </div>
      <div class="q-header-actions">
        <button id="btn-bookmark-q" class="btn btn-ghost btn-sm ${isBookmarked ? "btn-pill-active" : ""}" title="Simpan ke daftar bookmark (B)">${isBookmarked ? "🔖 Tersimpan" : "🔖 Bookmark"}</button>
        <button id="btn-flag-q" class="btn btn-ghost btn-sm ${isFlagged ? "btn-pill-active" : ""}" title="Tandai soal sulit (F)">${isFlagged ? "🚩 Sulit" : "🏳 Tandai"}</button>
      </div>
    </div>
    <div class="q-text markdown-body">${renderMd(q.question)}</div>
    <div class="options-list">${optionsHtml}</div>
    ${explHtml}
    <div class="q-note-box">
      <div class="q-note-head">
        <label for="question-note-input">📝 Catatan Pribadi Soal Ini</label>
        <span class="muted" id="q-note-status" style="font-size:12px;">${qNote ? "✓ Tersimpan" : ""}</span>
      </div>
      <textarea id="question-note-input" placeholder="Tulis rumus singkat, jebakan soal, atau pengingat pribadi untuk soal #${q.id}...">${escHtml(qNote)}</textarea>
    </div>
  `;

  applyMath(stage);
  highlightAndScrollIfActive(stage);

  document.getElementById("q-counter").textContent = `Soal ${state.activeQIdx + 1} / ${state.filteredQuestions.length}`;
  const answeredInFilter = state.filteredQuestions.filter((item) =>
    isExamMode ? state.examAnswers[item._key] !== undefined : getAnswer(prog, item) !== undefined
  ).length;
  document.getElementById("quiz-progress-fill").style.width = `${Math.round((answeredInFilter / state.filteredQuestions.length) * 100)}%`;

  const gotoStat = document.getElementById("btn-exam-goto-stat");
  if (gotoStat) gotoStat.addEventListener("click", () => navigateTo("statistik"));

  stage.querySelectorAll(".option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (isExamMode && !state.examActive && !state.examSubmitted) {
        alert("Klik 'Mulai Simulasi UAS' terlebih dahulu untuk memulai simulasi ber-timer.");
        return;
      }
      if (isExamMode && state.examSubmitted) return;
      const optIdx = Number(btn.dataset.opt);
      if (isExamMode) {
        state.examAnswers[q._key] = optIdx;
        renderCurrentQuestion();
        renderQuestionGrid();
        return;
      }
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
      recordDailyActivity("questions", c, `Latihan ${q.bab} #${q.id}`);
      saveLastPosition({ section: "latihan", latihanTab: "quiz", qKey: q._key });
      checkStageCompletionCelebration(c, prog, q._stage);
      refreshGamifyUI();
      updateCourseTopbar();
      renderCurrentQuestion();
      renderQuestionGrid();
    });
  });

  document.getElementById("btn-bookmark-q").addEventListener("click", () => {
    toggleBookmarkQ(prog, q);
    saveProgress();
    renderCurrentQuestion();
    renderQuestionGrid();
  });

  document.getElementById("btn-flag-q").addEventListener("click", () => {
    toggleFlagQ(prog, q);
    saveProgress();
    renderCurrentQuestion();
    renderQuestionGrid();
  });

  document.getElementById("question-note-input").addEventListener("input", (e) => {
    setQuestionNote(prog, q, e.target.value);
    saveProgress();
    const st = document.getElementById("q-note-status");
    if (st) st.textContent = e.target.value.trim() ? "✓ Tersimpan otomatis" : "";
  });

  const jumpBtn = document.getElementById("btn-jump-remedial");
  if (jumpBtn) {
    jumpBtn.addEventListener("click", () => {
      const idx = (c.chapters || []).findIndex((ch) => ch.bab === q.bab);
      if (idx >= 0) {
        state.activeChapterIdx = idx;
        saveLastPosition({ section: "belajar", belajarTab: "modul", chapterIdx: idx });
        switchBelajarTab("modul");
        navigateTo("belajar");
      }
    });
  }
}

function renderQuestionGrid() {
  const grid = document.getElementById("question-grid");
  const prog = getCourseProg(state.activeCourse.id);
  const isExamMode = state.quizMode === "exam";
  const showCorrection = !isExamMode || state.examSubmitted;

  grid.innerHTML = state.filteredQuestions
    .map((q, idx) => {
      const chosen = isExamMode ? state.examAnswers[q._key] : getAnswer(prog, q);
      let cls = "q-dot";
      if (idx === state.activeQIdx) cls += " current";
      if (isFlaggedQ(prog, q)) cls += " flagged";
      if (isBookmarkedQ(prog, q)) cls += " bookmarked";
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
      saveLastPosition({ section: "latihan", latihanTab: "quiz" });
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
  const m = String(Math.floor(Math.max(0, state.examSecondsLeft) / 60)).padStart(2, "0");
  const s = String(Math.max(0, state.examSecondsLeft) % 60).padStart(2, "0");
  document.getElementById("exam-timer").textContent = `⏱️ ${m}:${s}`;
}

function finishExam() {
  stopExamTimer();
  const c = state.activeCourse;
  const prog = getCourseProg(c.id);
  const g = getGamify();

  state.examQuestions.forEach((q) => {
    const chosen = state.examAnswers[q._key];
    if (chosen === undefined) return;
    const firstAttempt = getAnswer(prog, q) === undefined;
    setAnswer(prog, q, chosen);
    if (firstAttempt) {
      if (chosen === q.answer_index) {
        g.correctRun++;
        if (g.correctRun > g.maxCorrectRun) g.maxCorrectRun = g.correctRun;
        awardXp(`q_${c.id}_${q._key}`, 10);
      } else {
        g.correctRun = 0;
      }
    }
    checkStageCompletionCelebration(c, prog, q._stage);
  });

  state.examActive = false;
  state.examSubmitted = true;
  state.activeQIdx = 0;

  const examList = state.examQuestions;
  const examRight = examList.filter((item) => state.examAnswers[item._key] === item.answer_index).length;
  const examAns = examList.filter((item) => state.examAnswers[item._key] !== undefined).length;
  const pct = examList.length ? Math.round((examRight / examList.length) * 100) : 0;
  recordStudySession({
    courseId: c.id,
    courseTitle: c.title.split("(")[0].trim(),
    mode: "Simulasi UAS",
    score: `${examRight}/${examList.length} (${pct}%)`,
    detail: `${examAns} dari ${examList.length} soal dijawab`,
  });
  recordDailyActivity("questions", c, `Simulasi UAS ${examRight}/${examList.length}`);

  saveProgress();
  refreshGamifyUI();
  updateCourseTopbar();
  document.getElementById("btn-start-exam").textContent = "Mulai Ujian Baru";
  launchSubtleConfetti();
  renderCurrentQuestion();
  renderQuestionGrid();
}

/* FLASHCARD: POIN INTI + HAFAL/BELUM + SPACED REPETITION */
function buildChapterPointCards(course) {
  const cards = [];
  (course.chapters || []).forEach((ch) => {
    const pts = ch.summary_points && ch.summary_points.length ? ch.summary_points : [ch.title];
    pts.forEach((pt, idx) => {
      cards.push({
        cardKey: `${ch.bab}::p${idx}`,
        bab: ch.bab,
        title: ch.title,
        uas_priority: ch.uas_priority,
        pointIdx: idx,
        pointTotal: pts.length,
        pointText: pt,
        formulas: ch.formulas_or_syntax || [],
        traps: ch.common_traps || [],
      });
    });
  });
  return cards;
}

function initFlashcardFilters() {
  const c = state.activeCourse;
  const sel = document.getElementById("fc-bab-filter");
  const babs = (c.chapters || []).map((ch) => ch.bab);
  sel.innerHTML = `<option value="all">Semua Bab</option>` + babs.map((b) => `<option value="${escHtml(b)}">${escHtml(b)}</option>`).join("");
  const modeSel = document.getElementById("fc-mode-filter");
  if (modeSel) modeSel.value = "all";
  buildFlashcardList();
}

function buildFlashcardList() {
  const c = state.activeCourse;
  const prog = getCourseProg(c.id);
  const bab = document.getElementById("fc-bab-filter").value;
  const deckMode = document.getElementById("fc-mode-filter")?.value || "all";
  const allCards = buildChapterPointCards(c).filter((card) => bab === "all" || card.bab === bab);
  const fcProg = prog.flashcards || {};

  const hafalCount = allCards.filter((card) => fcProg[card.cardKey]?.status === "hafal").length;
  const statsPill = document.getElementById("fc-stats-pill");
  if (statsPill) statsPill.textContent = `Hafal: ${hafalCount}/${allCards.length}`;

  let filtered = allCards.filter((card) => {
    const st = fcProg[card.cardKey]?.status || "new";
    if (deckMode === "due") return st !== "hafal";
    if (deckMode === "hafal") return st === "hafal";
    return true;
  });

  // Simple spaced repetition priority:
  // "belum" (higher wrongCount first) -> "new" -> "hafal" (lower box first)
  const weightOf = (card) => {
    const info = fcProg[card.cardKey];
    if (!info || info.status === "new") return 50;
    if (info.status === "belum") return -(info.wrongCount || 1) * 10;
    return 100 + (info.box || 1) * 10;
  };
  filtered.sort((a, b) => weightOf(a) - weightOf(b));

  // Boost missed cards so they appear more frequently in "all" mode
  if (deckMode === "all" && filtered.length >= 4) {
    const missed = filtered.filter((card) => fcProg[card.cardKey]?.status === "belum");
    if (missed.length) {
      const augmented = [];
      let mIdx = 0;
      filtered.forEach((card, i) => {
        augmented.push(card);
        if ((i + 1) % 4 === 0 && mIdx < missed.length) {
          augmented.push(missed[mIdx++]);
        }
      });
      filtered = augmented;
    }
  }

  state.fcList = filtered;
  state.fcIdx = 0;
  renderFlashcard();
}

function rateCurrentFlashcard(nextStatus) {
  if (!state.fcList.length || !state.activeCourse) return;
  const c = state.activeCourse;
  const prog = getCourseProg(c.id);
  if (!prog.flashcards) prog.flashcards = {};
  const card = state.fcList[state.fcIdx];
  const prev = prog.flashcards[card.cardKey] || { status: "new", box: 1, wrongCount: 0, seenCount: 0 };

  if (nextStatus === "belum") {
    prog.flashcards[card.cardKey] = {
      status: "belum",
      box: 1,
      wrongCount: (prev.wrongCount || 0) + 1,
      seenCount: (prev.seenCount || 0) + 1,
      lastReview: Date.now(),
    };
    // Re-insert missed card 3 steps ahead for immediate spaced repetition
    if (state.fcList.length > 1) {
      const insertPos = Math.min(state.fcList.length, state.fcIdx + 3);
      state.fcList.splice(insertPos, 0, card);
    }
  } else {
    prog.flashcards[card.cardKey] = {
      status: "hafal",
      box: Math.min(3, (prev.box || 0) + 1),
      wrongCount: prev.wrongCount || 0,
      seenCount: (prev.seenCount || 0) + 1,
      lastReview: Date.now(),
    };
    awardXp(`fc_${c.id}_${card.cardKey}`, 5);
  }
  saveProgress();
  recordDailyActivity("flashcards", c, `Flashcard ${card.bab}`);
  refreshGamifyUI();

  // Update stats pill & move to next card
  const allCards = buildChapterPointCards(c).filter((item) => {
    const bab = document.getElementById("fc-bab-filter").value;
    return bab === "all" || item.bab === bab;
  });
  const hafalCount = allCards.filter((item) => prog.flashcards[item.cardKey]?.status === "hafal").length;
  const statsPill = document.getElementById("fc-stats-pill");
  if (statsPill) statsPill.textContent = `Hafal: ${hafalCount}/${allCards.length}`;

  if (state.fcIdx < state.fcList.length - 1) {
    state.fcIdx++;
  } else {
    state.fcIdx = 0;
  }
  renderFlashcard();
}

function renderFlashcard() {
  const box = document.getElementById("flashcard-box");
  if (!box) return;
  box.classList.remove("flipped");

  const statusBadge = document.getElementById("fc-status-badge");
  if (!state.fcList.length) {
    document.getElementById("fc-tag").textContent = "Deck Kosong";
    document.getElementById("fc-front-title").textContent = "Tidak ada kartu pada filter ini";
    document.getElementById("fc-front-body").innerHTML = `<p class="muted">Semua kartu pada filter ini sudah selesai atau belum ditandai. Coba pilih mode deck <strong>Semua Poin Inti</strong>.</p>`;
    document.getElementById("fc-back-body").innerHTML = "";
    if (statusBadge) { statusBadge.textContent = "✅ Selesai"; statusBadge.className = "fc-status-pill hafal"; }
    document.getElementById("fc-counter").textContent = "0 / 0";
    return;
  }

  const c = state.activeCourse;
  const prog = getCourseProg(c.id);
  const card = state.fcList[state.fcIdx];
  const info = (prog.flashcards && prog.flashcards[card.cardKey]) || { status: "new", box: 1, wrongCount: 0 };

  if (statusBadge) {
    if (info.status === "hafal") {
      statusBadge.textContent = `✅ Hafal (Kotak ${info.box || 1})`;
      statusBadge.className = "fc-status-pill hafal";
    } else if (info.status === "belum") {
      statusBadge.textContent = `🔁 Belum Hafal (${info.wrongCount || 1}× ulang)`;
      statusBadge.className = "fc-status-pill belum";
    } else {
      statusBadge.textContent = "⚪ Baru";
      statusBadge.className = "fc-status-pill";
    }
  }

  document.getElementById("fc-tag").textContent = `${card.bab} • Poin ${card.pointIdx + 1}/${card.pointTotal} • UAS: ${card.uas_priority}`;
  document.getElementById("fc-front-title").textContent = card.title;
  document.getElementById("fc-front-body").innerHTML = `<div class="fc-point-focus">${renderInlineMd(card.pointText)}</div>`;
  const formulas = (card.formulas || []).map((f) => `<li>${renderInlineMd(f)}</li>`).join("");
  const traps = (card.traps || []).map((t) => `<li>${renderInlineMd(t)}</li>`).join("");
  document.getElementById("fc-back-body").innerHTML = `
    ${formulas ? `<h4>Rumus / Sintaks (${escHtml(card.bab)})</h4><ul>${formulas}</ul>` : ""}
    ${traps ? `<h4>Jebakan UAS</h4><ul>${traps}</ul>` : ""}
    ${!formulas && !traps ? `<p class="muted">Pahami konsep inti ini beserta penerapannya pada contoh di Modul Baca.</p>` : ""}
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
      saveLastPosition({ section: "latihan", latihanTab: "practice", labIdx: state.activeLabIdx });
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
        recordDailyActivity("labs", c, `Lab #${lab.id}: ${lab.title}`);
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
      recordDailyActivity("labs", c, `Lab #${lab.id}: ${lab.title}`);
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

function computeWeakestTopics(course) {
  const prog = getCourseProg(course.id);
  const qs = getStageQuestions(course, "all");
  const topicMap = new Map();
  qs.forEach((q) => {
    const ch = getAnswer(prog, q);
    if (ch === undefined || ch === q.answer_index) return;
    const topic = q.remedial_section || q.bab || "Umum";
    if (!topicMap.has(topic)) {
      topicMap.set(topic, { topic, bab: q.bab, wrongCount: 0, priority: q.uas_priority || "Sedang" });
    }
    topicMap.get(topic).wrongCount += 1;
  });
  return [...topicMap.values()].sort((a, b) => b.wrongCount - a.wrongCount);
}

function computeReviewPriorities(course) {
  const stats = computeChapterStats(course);
  const prioWeight = { "Sangat Tinggi": 3, "Tinggi": 2, "Sedang": 1 };
  const list = stats
    .filter((s) => s.wrong_items.length > 0 || (s.acc !== null && s.acc < 80) || (!s.mastered_manual && s.uas_priority === "Sangat Tinggi"))
    .map((s) => {
      const subCounts = new Map();
      s.wrong_items.forEach((w) => {
        const key = w.remedial_section || w.bab;
        subCounts.set(key, (subCounts.get(key) || 0) + 1);
      });
      const subtopicsOrdered = [...subCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name, cnt]) => ({ name, count: cnt }));
      const score =
        s.wrong_items.length * 25 +
        (s.acc !== null ? Math.max(0, 80 - s.acc) : 20) +
        (prioWeight[s.uas_priority] || 1) * 10 +
        (!s.mastered_manual ? 12 : 0);
      return { ...s, subtopicsOrdered, priorityScore: score };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .map((s, idx) => {
      let tierCls = "prio-3";
      let tierLabel = "Perlu Review";
      if (s.wrong_items.length >= 2 || (s.acc !== null && s.acc < 60) || (idx === 0 && s.wrong_items.length > 0)) {
        tierCls = "prio-1";
        tierLabel = "Kritis — Wajib Diulang";
      } else if (s.wrong_items.length > 0 || s.uas_priority === "Sangat Tinggi") {
        tierCls = "prio-2";
        tierLabel = "Prioritas Tinggi";
      }
      return { ...s, rank: idx + 1, tierCls, tierLabel };
    });
  return list;
}

function renderHorizontalSvgBarChart({ rows, emptyText, targetThreshold = null }) {
  if (!rows.length) {
    return `<div class="empty-state" style="padding:20px;"><p style="margin:0;">${escHtml(emptyText)}</p></div>`;
  }
  const width = 560;
  const labelW = 176;
  const barMaxW = 272;
  const barStartX = labelW + 8;
  const rowH = 30;
  const padTop = 24;
  const height = padTop + rows.length * rowH + 18;

  const gridLines = [0, 25, 50, 75, 100].map((pct) => {
    const x = barStartX + (barMaxW * pct) / 100;
    return `
      <line x1="${x}" y1="${padTop - 8}" x2="${x}" y2="${height - 16}" stroke="currentColor" stroke-opacity="0.14" stroke-dasharray="3,3" />
      <text x="${x}" y="12" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.65">${pct}%</text>`;
  }).join("");

  const threshLine = targetThreshold !== null
    ? (() => {
        const tx = barStartX + (barMaxW * targetThreshold) / 100;
        return `<line x1="${tx}" y1="${padTop - 8}" x2="${tx}" y2="${height - 14}" stroke="#5E8C75" stroke-width="1.6" stroke-dasharray="4,2" opacity="0.75" />`;
      })()
    : "";

  const bars = rows.map((r, i) => {
    const y = padTop + i * rowH;
    const pctVal = r.pct === null ? 0 : Math.max(0, Math.min(100, r.pct));
    const fillW = r.pct === null ? 0 : Math.max(4, Math.round((barMaxW * pctVal) / 100));
    const lbl = r.label.length > 24 ? `${r.label.slice(0, 23)}…` : r.label;
    return `
      <g>
        <text x="${labelW}" y="${y + 15}" text-anchor="end" font-size="11.5" font-weight="700" fill="currentColor">${escHtml(lbl)}</text>
        <rect x="${barStartX}" y="${y + 3}" width="${barMaxW}" height="16" rx="7" fill="currentColor" fill-opacity="0.09" />
        ${fillW ? `<rect x="${barStartX}" y="${y + 3}" width="${fillW}" height="16" rx="7" fill="${r.barColor}" />` : ""}
        <text x="${barStartX + barMaxW + 8}" y="${y + 15}" font-size="11" font-weight="700" fill="currentColor" opacity="0.88">${escHtml(r.valueText)}</text>
      </g>`;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik batang skor belajar" style="color:var(--text);">
      ${gridLines}
      ${threshLine}
      ${bars}
    </svg>`;
}

function renderSessionHistoryPanel() {
  const host = document.getElementById("stat-session-history");
  if (!host) return;
  const sessions = getStudySessions();
  const reports = getSavedReports();
  const combined = [
    ...sessions.map((s) => ({
      title: `${s.courseTitle} — ${s.mode}`,
      sub: `${s.dateKey} (${s.modified}) • ${s.detail || `${s.count || 1} aktivitas`}`,
      badge: s.score && s.score !== "-" ? `Skor ${s.score}` : `${s.count || 1}×`,
    })),
    ...reports.map((r) => ({
      title: `📄 Ekspor MD — ${r.courseTitle || "Laporan"}`,
      sub: `${r.modified} • ${r.filename}`,
      badge: "Tersimpan",
    })),
  ].slice(0, 12);

  if (!combined.length) {
    host.innerHTML = `<div class="empty-state" style="padding:20px;"><p style="margin:0;">Belum ada riwayat sesi. Kerjakan soal, lab, flashcard, atau simpan laporan MD untuk merekam sesi.</p></div>`;
    return;
  }
  host.innerHTML = `<div class="session-hist-list">${combined
    .map(
      (item) => `
    <div class="sess-hist-item">
      <div style="min-width:0;">
        <div style="font-weight:800;font-size:13.5px;">${escHtml(item.title)}</div>
        <div class="muted" style="font-size:12px;">${escHtml(item.sub)}</div>
      </div>
      <span class="c-badge pastel">${escHtml(item.badge)}</span>
    </div>`
    )
    .join("")}</div>`;
}

function renderStatistikPanels(course) {
  const g = getGamify();
  const target = g.dailyTarget || 15;
  const todayCnt = getTodayActivityCount();
  const dailyPct = Math.min(100, Math.round((todayCnt / target) * 100));

  const targetSel = document.getElementById("stat-daily-target");
  if (targetSel) targetSel.value = String(target);
  const progTxt = document.getElementById("stat-daily-progress-text");
  if (progTxt) progTxt.textContent = `${todayCnt} / ${target} aktivitas (${dailyPct}%)${todayCnt >= target ? " 🎉 Tercapai!" : ""}`;
  const progFill = document.getElementById("stat-daily-progress-fill");
  if (progFill) progFill.style.width = `${dailyPct}%`;

  const weakest = computeWeakestTopics(course);
  const weakEl = document.getElementById("stat-weakest-topic");
  const weakSubEl = document.getElementById("stat-weakest-sub");
  if (weakEl && weakSubEl) {
    if (!weakest.length) {
      weakEl.textContent = "Belum ada kesalahan tercatat";
      weakSubEl.textContent = "Bagus! Belum ada soal salah di mata kuliah ini.";
    } else {
      const top = weakest[0];
      weakEl.textContent = `${top.bab}: ${top.topic}`;
      weakSubEl.textContent = `${top.wrongCount} jawaban salah • Prioritas UAS: ${top.priority}` +
        (weakest.length > 1 ? ` | Lainnya: ${weakest.slice(1, 3).map((x) => `${x.topic} (${x.wrongCount})`).join(", ")}` : "");
    }
  }

  // Chart 1: Per Course Score
  const courseChartHost = document.getElementById("chart-courses-svg");
  if (courseChartHost) {
    const courseRows = state.index.map((item) => {
      const cObj = state.coursesCache[item.id];
      const theme = getCourseTheme(item.id);
      const shortName = `${theme.emoji} ${item.title.split("(")[0].trim()}`;
      if (!cObj) return { label: shortName, pct: null, valueText: "-", barColor: theme.color };
      const qs = getStageQuestions(cObj, "all");
      const pObj = getCourseProg(item.id);
      const ans = qs.filter((q) => getAnswer(pObj, q) !== undefined);
      const cor = ans.filter((q) => getAnswer(pObj, q) === q.answer_index);
      const pct = ans.length ? Math.round((cor.length / ans.length) * 100) : null;
      return {
        label: shortName,
        pct,
        valueText: pct !== null ? `${pct}% (${cor.length}/${ans.length})` : "Belum diuji",
        barColor: theme.color,
      };
    });
    courseChartHost.innerHTML = renderHorizontalSvgBarChart({ rows: courseRows, emptyText: "Belum ada data matkul." });
  }

  // Chart 2: Per Chapter Score (Active Course)
  const chapStats = computeChapterStats(course);
  const chapChartHost = document.getElementById("chart-chapters-svg");
  if (chapChartHost) {
    const chapRows = chapStats.map((s) => {
      let barColor = "#B7D3C0";
      if (s.acc !== null) {
        if (s.acc >= 80) barColor = "#9FD4B8";
        else if (s.acc >= 60) barColor = "#FFD9A0";
        else barColor = "#F5B8C0";
      }
      return {
        label: `${s.bab}: ${s.title}`,
        pct: s.acc,
        valueText: s.acc !== null ? `${s.acc}% (${s.correct}/${s.answered})` : "Belum diuji",
        barColor,
      };
    });
    chapChartHost.innerHTML = renderHorizontalSvgBarChart({
      rows: chapRows,
      emptyText: "Belum ada bab pada mata kuliah ini.",
      targetThreshold: 80,
    });
  }

  // Review Priorities Panel
  const recHost = document.getElementById("stat-review-recommendations");
  if (recHost) {
    const recs = computeReviewPriorities(course);
    if (!recs.length) {
      recHost.innerHTML = `<div class="empty-state" style="padding:20px;"><p style="margin:0;">🎉 Luar biasa! Semua bab sudah terkuasai baik atau tidak ada kesalahan soal.</p></div>`;
    } else {
      recHost.innerHTML = `<div class="rec-list">${recs
        .map(
          (r) => `
        <div class="rec-item ${r.tierCls}">
          <div class="rec-head">
            <div>
              <strong>#${r.rank} ${escHtml(r.bab)}: ${escHtml(r.title)}</strong>
              <div class="muted" style="font-size:12px;">
                UAS: ${escHtml(r.uas_priority)} • ${r.wrong_items.length} salah${r.acc !== null ? ` • Akurasi ${r.acc}%` : " • Belum dipahami"}
              </div>
            </div>
            <span class="rec-rank">${escHtml(r.tierLabel)}</span>
          </div>
          ${r.subtopicsOrdered.length ? `<div style="font-size:12.5px;color:var(--text);">Topik lemah: ${r.subtopicsOrdered.map((st) => `<strong>${escHtml(st.name)}</strong> (${st.count}×)`).join(", ")}</div>` : ""}
          <div class="rec-actions">
            <button class="btn btn-ghost btn-sm rec-goto-modul" data-bab="${escHtml(r.bab)}">📖 Buka Modul</button>
            ${r.wrong_items.length ? `<button class="btn btn-primary btn-sm rec-goto-remedial" data-bab="${escHtml(r.bab)}">🔁 Remedial Bab Ini</button>` : ""}
          </div>
        </div>`
        )
        .join("")}</div>`;

      recHost.querySelectorAll(".rec-goto-modul").forEach((b) => {
        b.addEventListener("click", () => {
          const idx = (course.chapters || []).findIndex((ch) => ch.bab === b.dataset.bab);
          if (idx >= 0) {
            state.activeChapterIdx = idx;
            saveLastPosition({ section: "belajar", belajarTab: "modul", chapterIdx: idx });
            switchBelajarTab("modul");
            navigateTo("belajar");
          }
        });
      });

      recHost.querySelectorAll(".rec-goto-remedial").forEach((b) => {
        b.addEventListener("click", () => {
          state.quizMode = "remedial";
          document.getElementById("quiz-mode").value = "remedial";
          if (document.getElementById("quiz-filter-stage").querySelector('option[value="all"]')) {
            state.activeStage = "all";
            document.getElementById("quiz-filter-stage").value = "all";
            populateQuizBabDropdown();
          }
          const babSel = document.getElementById("quiz-filter-bab");
          if ([...babSel.options].some((o) => o.value === b.dataset.bab)) {
            babSel.value = b.dataset.bab;
          }
          syncQuizModeUI();
          applyQuizFilters(true);
          switchLatihanTab("quiz");
          navigateTo("latihan");
        });
      });
    }
  }

  renderSessionHistoryPanel();
}

function buildDiagnosticMarkdown(course) {
  const prog = getCourseProg(course.id);
  const g = getGamify();
  const stats = computeChapterStats(course);
  const needReview = computeReviewPriorities(course);
  const weakestTopics = computeWeakestTopics(course);
  const notMastered = stats.filter((s) => !s.mastered_manual);
  const qs = getStageQuestions(course, "all");
  const totalAns = qs.filter((q) => getAnswer(prog, q) !== undefined).length;
  const totalCorrect = qs.filter((q) => getAnswer(prog, q) === q.answer_index).length;
  const overallAcc = totalAns ? Math.round((totalCorrect / totalAns) * 100) : 0;

  const labs = course.practice_labs || [];
  const labsPassed = labs.filter((l) => prog.labPassed[l.id]).length;
  const nowStr = new Date().toLocaleString("id-ID");

  let md = `# Laporan Analisis Sesi Belajar & Diagnostik UAS\n\n`;
  md += `- **Mata Kuliah**: ${course.title} (\`${course.code}\`)\n`;
  md += `- **Semester**: Semester ${course.semester}\n`;
  md += `- **Waktu Ekspor**: ${nowStr}\n`;
  md += `- **Streak & Target Harian**: ${g.dailyStreak} hari | Hari ini ${getTodayActivityCount()}/${g.dailyTarget || 15} aktivitas (${g.xp} XP)\n`;
  md += `- **Skor Soal**: ${totalCorrect} / ${totalAns} dijawab (Total bank soal: ${qs.length}) — **Akurasi: ${overallAcc}%**\n`;
  md += `- **Lab Praktek Selesai**: ${labsPassed} / ${labs.length}\n\n`;

  md += `## 1. Peta Penguasaan Per Bab / Sesi\n\n`;
  md += `| Bab | Judul | Prioritas UAS | Dijawab | Benar | Akurasi | Status | Ditandai Paham |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :--- | :---: |\n`;
  for (const s of stats) {
    md += `| ${s.bab} | ${s.title} | ${s.uas_priority} | ${s.answered}/${s.total_q} | ${s.correct} | ${s.acc !== null ? s.acc + "%" : "-"} | ${s.status} | ${s.mastered_manual ? "Ya" : "Belum"} |\n`;
  }

  md += `\n## 2. Urutan Prioritas Topik & Bab yang Harus Diulang\n\n`;
  if (!needReview.length) {
    md += `Semua bab yang telah diuji mencapai akurasi >= 80%. Pertahankan dengan latihan soal acak dan cek bagian *Tambahan UAS*.\n\n`;
  } else {
    needReview.forEach((s) => {
      md += `### Prioritas #${s.rank} — ${s.bab}: ${s.title} [${s.tierLabel} | UAS: ${s.uas_priority}]\n`;
      md += `- **Status**: ${s.status} ${s.acc !== null ? `(Akurasi ${s.acc}%, Salah ${s.wrong_items.length})` : "(Belum ditandai paham)"}\n`;
      if (s.subtopicsOrdered.length) {
        md += `- **Urutan Subtopik untuk Diulang**:\n`;
        s.subtopicsOrdered.forEach((st, idx) => { md += `  ${idx + 1}. ${st.name} (${st.count} salah)\n`; });
      } else {
        md += `- **Rekomendasi**: Baca ulang poin inti & rumus kunci pada modul ${s.bab}, lalu kerjakan latihan soal bab ini.\n`;
      }
      if (s.note) md += `- **Catatan Pribadi Anda**: ${s.note}\n`;
      md += `\n`;
    });
  }

  md += `## 3. Bagian yang Belum Ditandai Paham (${notMastered.length} Bab)\n\n`;
  if (!notMastered.length) {
    md += `Seluruh bab pada mata kuliah ini sudah ditandai paham.\n\n`;
  } else {
    notMastered.forEach((s) => {
      md += `- **${s.bab}: ${s.title}** (Prioritas UAS: ${s.uas_priority}${s.acc !== null ? ` • Akurasi ${s.acc}%` : ""})\n`;
    });
    md += `\n`;
  }

  const allWrong = qs.filter((q) => {
    const ch = getAnswer(prog, q);
    return ch !== undefined && ch !== q.answer_index;
  });
  md += `## 4. Topik Terlemah & Daftar Soal Salah (${allWrong.length} Soal)\n\n`;
  if (weakestTopics.length) {
    md += `**Urutan Topik Terlemah:**\n`;
    weakestTopics.forEach((wt, i) => {
      md += `${i + 1}. **${wt.topic}** (${wt.bab}) — ${wt.wrongCount} salah (UAS: ${wt.priority})\n`;
    });
    md += `\n`;
  }
  if (!allWrong.length) {
    md += `Belum ada soal salah yang tercatat pada sesi ini.\n\n`;
  } else {
    const letters = ["A", "B", "C", "D"];
    allWrong.forEach((q) => {
      const chosenIdx = getAnswer(prog, q);
      const qn = getQuestionNote(prog, q);
      md += `- **Soal #${q.id} (${q.bab} | UAS: ${q.uas_priority})**: ${q.question}\n`;
      md += `  - Jawaban Anda: **${letters[chosenIdx]}** (${q.options[chosenIdx]})\n`;
      md += `  - Kunci Benar: **${letters[q.answer_index]}** (${q.options[q.answer_index]})\n`;
      md += `  - Remedial: *${q.remedial_section || q.bab}*\n`;
      if (qn) md += `  - Catatan Soal Anda: ${qn}\n`;
      md += `  - Ringkasan Pembahasan: ${q.explanation}\n\n`;
    });
  }

  const unpassedLabs = labs.filter((l) => !prog.labPassed[l.id]);
  md += `## 5. Status Lab Praktek & Rencana Aksi Menjelang UAS\n\n`;
  md += `- Lab Selesai: **${labsPassed}** | Belum Selesai: **${unpassedLabs.length}**\n`;
  if (unpassedLabs.length) {
    md += `- Lab yang perlu diselesaikan:\n`;
    unpassedLabs.forEach((l) => { md += `  - Lab #${l.id} (${l.bab}): ${l.title}\n`; });
  }
  md += `\n1. Pelajari ulang daftar **Urutan Prioritas Topik & Bab yang Harus Diulang** di atas dari Prioritas #1.\n`;
  md += `2. Buka tab **Tambahan UAS** dan **Cheat Sheet** untuk memastikan materi BMP tidak ada yang terlewat.\n`;
  md += `3. Gunakan mode **Remedial (Soal Salah)** di Simulasi Soal hingga seluruh soal remedial terjawab benar.\n`;
  return md;
}

function renderAnalyticsTab() {
  const c = state.activeCourse;
  if (!c) return;
  renderStatistikPanels(c);
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
  renderSessionHistoryPanel();
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

/* PENCARIAN GLOBAL & PENYOROTAN HASIL */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHighlightedSnippet(rawText, query, maxLen = 155) {
  const clean = String(rawText || "")
    .replace(/\$\$[\s\S]*?\$\$/g, " [rumus] ")
    .replace(/[`*_#>\[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  if (!query) return escHtml(clean.slice(0, maxLen)) + (clean.length > maxLen ? "..." : "");
  const lower = clean.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  let slice = "";
  if (idx < 0) {
    slice = clean.slice(0, maxLen) + (clean.length > maxLen ? "..." : "");
  } else {
    const start = Math.max(0, idx - 45);
    const end = Math.min(clean.length, start + maxLen);
    slice = (start > 0 ? "..." : "") + clean.slice(start, end) + (end < clean.length ? "..." : "");
  }
  const safe = escHtml(slice);
  const re = new RegExp(`(${escapeRegex(escHtml(query))})`, "gi");
  return safe.replace(re, `<mark class="search-hl">$1</mark>`);
}

function highlightAndScrollIfActive(rootEl) {
  const query = (state.activeSearchHighlight || "").trim();
  if (!rootEl || query.length < 2) return;
  const re = new RegExp(`(${escapeRegex(query)})`, "gi");
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest("script, style, textarea, input, select, button, mark, .katex, .q-note-box")) {
        return NodeFilter.FILTER_REJECT;
      }
      return re.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  let cur;
  while ((cur = walker.nextNode())) nodes.push(cur);
  let firstMark = null;
  nodes.forEach((txtNode) => {
    re.lastIndex = 0;
    const parts = txtNode.nodeValue.split(re);
    if (parts.length <= 1) return;
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (!part) return;
      if (part.toLowerCase() === query.toLowerCase()) {
        const mark = document.createElement("mark");
        mark.className = "search-hl";
        mark.textContent = part;
        if (!firstMark) firstMark = mark;
        frag.appendChild(mark);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    });
    txtNode.parentNode.replaceChild(frag, txtNode);
  });
  if (firstMark) {
    setTimeout(() => {
      firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }
}

function openGlobalSearchModal() {
  const modal = document.getElementById("global-search-modal");
  if (!modal) return;
  modal.style.display = "grid";
  runGlobalSearch();
  setTimeout(() => {
    const inp = document.getElementById("global-search-input");
    if (inp) { inp.focus(); inp.select(); }
  }, 30);
}

function closeGlobalSearchModal() {
  const modal = document.getElementById("global-search-modal");
  if (modal) modal.style.display = "none";
}

function collectGlobalSearchHits(query, scope, currentOnly) {
  const qLower = query.toLowerCase();
  const courses = currentOnly && state.activeCourse
    ? [state.activeCourse]
    : state.index.map((item) => state.coursesCache[item.id]).filter(Boolean);
  const hits = [];

  courses.forEach((c) => {
    const theme = getCourseTheme(c.id);
    const prog = getCourseProg(c.id);
    const shortCourse = c.title.split("(")[0].trim();

    if (scope === "all" || scope === "modul") {
      (c.chapters || []).forEach((ch, chapIdx) => {
        const formulasTxt = (ch.formulas_or_syntax || []).join(" | ");
        const summaryTxt = (ch.summary_points || []).join(" | ");
        const trapsTxt = (ch.common_traps || []).join(" | ");
        const fullTxt = `${ch.bab} ${ch.title} ${summaryTxt} ${formulasTxt} ${trapsTxt} ${ch.content_md || ""}`;
        if (fullTxt.toLowerCase().includes(qLower)) {
          const isTermHit = formulasTxt.toLowerCase().includes(qLower) || summaryTxt.toLowerCase().includes(qLower);
          const snippetSrc = isTermHit
            ? (formulasTxt.toLowerCase().includes(qLower) ? formulasTxt : summaryTxt)
            : `${ch.title} — ${ch.content_md || summaryTxt}`;
          hits.push({
            score: (`${ch.bab} ${ch.title}`).toLowerCase().includes(qLower) ? 100 : (isTermHit ? 85 : 60),
            kind: isTermHit ? "Istilah / Poin Inti" : "Modul Baca",
            emoji: theme.emoji,
            courseId: c.id,
            courseTitle: shortCourse,
            title: `${ch.bab}: ${ch.title}`,
            snippet: buildHighlightedSnippet(snippetSrc, query),
            section: "belajar",
            belajarTab: "modul",
            chapterIdx: chapIdx,
          });
        }
      });

      (c.uas_gaps || []).forEach((g) => {
        const gTxt = `${g.topic} ${g.why_important || ""} ${g.content_md || ""}`;
        if (gTxt.toLowerCase().includes(qLower)) {
          hits.push({
            score: g.topic.toLowerCase().includes(qLower) ? 90 : 58,
            kind: "Tambahan UAS",
            emoji: theme.emoji,
            courseId: c.id,
            courseTitle: shortCourse,
            title: g.topic,
            snippet: buildHighlightedSnippet(`${g.why_important || ""} ${g.content_md || ""}`, query),
            section: "belajar",
            belajarTab: "uas-gaps",
          });
        }
      });
    }

    if (scope === "all" || scope === "soal") {
      const qs = getStageQuestions(c, "all");
      qs.forEach((q) => {
        const hay = `${q.bab} ${q.question} ${(q.options || []).join(" ")} ${q.explanation || ""} ${q.remedial_section || ""}`;
        if (hay.toLowerCase().includes(qLower)) {
          hits.push({
            score: q.question.toLowerCase().includes(qLower) ? 80 : 50,
            kind: `Soal T${q._stage} #${q.id}`,
            emoji: theme.emoji,
            courseId: c.id,
            courseTitle: shortCourse,
            title: `${q.bab} — Soal #${q.id} (Tahap ${q._stage})`,
            snippet: buildHighlightedSnippet(`${q.question} ${q.explanation || ""}`, query),
            section: "latihan",
            latihanTab: "quiz",
            stage: String(q._stage),
            qKey: q._key,
          });
        }
      });
    }

    if (scope === "all" || scope === "notes") {
      (c.chapters || []).forEach((ch, chapIdx) => {
        const note = (prog.notes && prog.notes[ch.bab]) || "";
        if (!note.trim()) return;
        if (!query || note.toLowerCase().includes(qLower) || ch.bab.toLowerCase().includes(qLower)) {
          hits.push({
            score: 75,
            kind: "Catatan Bab",
            emoji: theme.emoji,
            courseId: c.id,
            courseTitle: shortCourse,
            title: `Catatan ${ch.bab}: ${ch.title}`,
            snippet: buildHighlightedSnippet(note, query),
            section: "belajar",
            belajarTab: "modul",
            chapterIdx: chapIdx,
          });
        }
      });

      const qs = getStageQuestions(c, "all");
      qs.forEach((q) => {
        const bm = isBookmarkedQ(prog, q);
        const qn = getQuestionNote(prog, q);
        if (!bm && !qn) return;
        const txt = `${q.bab} ${q.question} ${qn}`;
        if (!query || txt.toLowerCase().includes(qLower)) {
          hits.push({
            score: bm ? 82 : 70,
            kind: bm ? "🔖 Bookmark Soal" : "Catatan Soal",
            emoji: theme.emoji,
            courseId: c.id,
            courseTitle: shortCourse,
            title: `${bm ? "🔖 " : ""}Soal #${q.id} (${q.bab}, T${q._stage})`,
            snippet: buildHighlightedSnippet(qn || q.question, query),
            section: "latihan",
            latihanTab: "quiz",
            stage: String(q._stage),
            qKey: q._key,
          });
        }
      });
    }
  });

  hits.sort((a, b) => b.score - a.score);
  return hits;
}

function runGlobalSearch() {
  const inputEl = document.getElementById("global-search-input");
  const resultsEl = document.getElementById("global-search-results");
  const countEl = document.getElementById("global-search-count");
  if (!inputEl || !resultsEl) return;

  const query = inputEl.value.trim();
  const currentOnly = !!document.getElementById("gs-current-only")?.checked;
  const scope = state.gsScope || "all";

  if (query.length < 2 && scope !== "notes") {
    if (countEl) countEl.textContent = "Ketik minimal 2 huruf untuk mencari lintas modul, soal, dan istilah.";
    resultsEl.innerHTML = `
      <div class="empty-state">
        <h4>Cari Lintas 13 Mata Kuliah</h4>
        <p>Ketik istilah seperti <code>Bayes</code>, <code>normalisasi</code>, <code>chi-square</code>, atau buka tab <strong>🔖 Catatan &amp; Bookmark</strong> di atas.</p>
      </div>`;
    return;
  }

  const allHits = collectGlobalSearchHits(query, scope, currentOnly);
  const shown = allHits.slice(0, 45);
  if (countEl) {
    countEl.textContent = `Ditemukan ${allHits.length} hasil${allHits.length > 45 ? " (menampilkan 45 teratas)" : ""}${query ? ` untuk "${query}"` : ""}.`;
  }

  if (!shown.length) {
    resultsEl.innerHTML = `
      <div class="empty-state">
        <h4>Tidak ada hasil yang cocok</h4>
        <p>${scope === "notes" ? "Belum ada bookmark soal atau catatan pribadi yang tersimpan." : `Coba kata kunci lain atau nonaktifkan filter "Matkul aktif saja".`}</p>
      </div>`;
    return;
  }

  resultsEl.innerHTML = shown
    .map(
      (h, idx) => `
    <div class="gs-hit-card" data-gs-idx="${idx}" tabindex="0" role="button">
      <div class="gs-hit-top">
        <span class="c-badge pastel">${h.emoji} ${escHtml(h.courseTitle)}</span>
        <span class="c-badge">${escHtml(h.kind)}</span>
      </div>
      <div class="gs-hit-title">${query ? buildHighlightedSnippet(h.title, query, 120) : escHtml(h.title)}</div>
      <div class="gs-hit-snippet">${h.snippet}</div>
    </div>`
    )
    .join("");

  resultsEl.querySelectorAll(".gs-hit-card").forEach((el) => {
    const activate = () => {
      const hit = shown[Number(el.dataset.gsIdx)];
      if (!hit) return;
      state.activeSearchHighlight = query.length >= 2 ? query : "";
      closeGlobalSearchModal();
      openCourse(hit.courseId, hit.section, {
        preservePosition: false,
        keepHighlight: true,
        belajarTab: hit.belajarTab,
        latihanTab: hit.latihanTab,
        chapterIdx: hit.chapterIdx,
        stage: hit.stage,
        babFilter: "all",
        quizMode: "instant",
        qKey: hit.qKey,
      });
    };
    el.addEventListener("click", activate);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") activate();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initPwaControls();
  init();
});
