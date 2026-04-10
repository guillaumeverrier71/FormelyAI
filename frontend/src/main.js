import "./style.css";
import { inject } from '@vercel/analytics';

// Initialize Vercel Web Analytics
inject();

const API_BASE = "";

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let currentUser = null;
let currentSessionId = null;
let currentSession = null;
let authTab = "login"; // "login" | "register"

// ─────────────────────────────────────────────────────────────────────────────
// API helper — sends cookies, handles 401 / 403
// ─────────────────────────────────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const res = await fetch(API_BASE + url, { credentials: "include", ...options });

  if (res.status === 401) {
    currentUser = null;
    showAuthModal();
    throw new Error("Non authentifié");
  }

  if (res.status === 403) {
    let detail = "Accès refusé";
    try { detail = (await res.json()).detail || detail; } catch {}
    if (detail === "upgrade_required" || detail === "quota_exceeded" || detail === "premium_required") {
      showPaywall(detail);
    } else {
      showToast(detail, "danger");
    }
    throw new Error(detail);
  }

  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// KaTeX
// ─────────────────────────────────────────────────────────────────────────────
window.renderMathInDocument = function () {
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
      strict: false,
    });
  }
};
window.addEventListener("load", () => window.renderMathInDocument());

// ─────────────────────────────────────────────────────────────────────────────
// Auth modal
// ─────────────────────────────────────────────────────────────────────────────
function showAuthModal(tab = "login") {
  switchAuthTab(tab);
  document.getElementById("authModal").classList.remove("hidden");
  document.getElementById("authModal").classList.add("flex");
  setTimeout(() => document.getElementById("authEmail").focus(), 50);
}

function hideAuthModal() {
  document.getElementById("authModal").classList.add("hidden");
  document.getElementById("authModal").classList.remove("flex");
}

function switchAuthTab(tab) {
  authTab = tab;
  const isLogin = tab === "login";

  document.getElementById("authTabLogin").className =
    "flex-1 py-2 rounded-lg text-sm font-semibold transition " +
    (isLogin ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700");
  document.getElementById("authTabRegister").className =
    "flex-1 py-2 rounded-lg text-sm font-semibold transition " +
    (!isLogin ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700");

  document.getElementById("authSubmitText").textContent = isLogin ? "Se connecter" : "Créer mon compte";
  document.getElementById("authSubmitBtn").querySelector("i").className =
    isLogin ? "bi bi-box-arrow-in-right" : "bi bi-person-plus";
  document.getElementById("authPasswordHint").classList.toggle("hidden", isLogin);
  document.getElementById("authSwitchText").textContent = isLogin ? "Pas encore de compte ?" : "Déjà un compte ?";
  document.getElementById("authSwitchBtn").textContent = isLogin ? "S'inscrire" : "Se connecter";
  document.getElementById("authSwitchBtn").onclick = () => switchAuthTab(isLogin ? "register" : "login");

  clearAuthError();
  if (document.getElementById("authPassword")) {
    document.getElementById("authPassword").autocomplete = isLogin ? "current-password" : "new-password";
  }
}

function showAuthError(msg) {
  document.getElementById("authErrorText").textContent = msg;
  document.getElementById("authError").classList.remove("hidden");
  document.getElementById("authError").classList.add("flex");
}

function clearAuthError() {
  document.getElementById("authError").classList.add("hidden");
  document.getElementById("authError").classList.remove("flex");
}

async function submitAuth(event) {
  event.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  clearAuthError();

  const btn = document.getElementById("authSubmitBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2"></span>Chargement…';

  try {
    const endpoint = authTab === "login" ? "/auth/login" : "/auth/register";
    const res = await fetch(API_BASE + endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showAuthError(data.detail || "Erreur de connexion.");
      return;
    }
    currentUser = data;
    hideAuthModal();
    updateNavbar();
    await loadSessions();
    showToast(authTab === "login" ? "Bienvenue !" : "Compte créé ! Bienvenue 🎉", "success");
  } catch {
    showAuthError("Erreur réseau. Réessaie.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="${authTab === "login" ? "bi bi-box-arrow-in-right" : "bi bi-person-plus"}"></i><span id="authSubmitText">${authTab === "login" ? "Se connecter" : "Créer mon compte"}</span>`;
  }
}

async function logout() {
  try {
    await fetch(API_BASE + "/auth/logout", { method: "POST", credentials: "include" });
  } catch {}
  currentUser = null;
  currentSessionId = null;
  currentSession = null;
  updateNavbar();
  showAuthModal("login");
  showToast("Déconnecté.", "info");
}

// ─────────────────────────────────────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────────────────────────────────────
function updateNavbar() {
  const navUser = document.getElementById("navUser");
  const navAuth = document.getElementById("navAuth");
  const navUsageBadge = document.getElementById("navUsageBadge");
  const navPlanBadge = document.getElementById("navPlanBadge");
  const navUpgradeBtn = document.getElementById("navUpgradeBtn");

  if (currentUser) {
    navUser.classList.remove("hidden");
    navUser.classList.add("flex");
    navAuth.classList.add("hidden");
    navAuth.classList.remove("flex");

    navUsageBadge.textContent = `${currentUser.pdfs_used} / ${currentUser.monthly_limit} PDF`;
    if (currentUser.plan === "premium") {
      navPlanBadge.classList.remove("hidden");
      navUpgradeBtn.classList.add("hidden");
    } else {
      navPlanBadge.classList.add("hidden");
      navUpgradeBtn.classList.remove("hidden");
    }
    updateUsageBar();
  } else {
    navUser.classList.add("hidden");
    navUser.classList.remove("flex");
    navAuth.classList.remove("hidden");
    navAuth.classList.add("flex");
  }
}

function updateUsageBar() {
  if (!currentUser) return;
  const bar = document.getElementById("usageBar");
  const usageText = document.getElementById("usageText");
  const upgradeBtn = document.getElementById("usageUpgradeBtn");

  bar.classList.remove("hidden");
  bar.classList.add("flex");

  const remaining = currentUser.monthly_limit - currentUser.pdfs_used + (currentUser.pdf_credits || 0);
  const label = currentUser.plan === "premium" ? "ce mois-ci" : "au total";
  usageText.textContent = `${currentUser.pdfs_used} / ${currentUser.monthly_limit} PDF utilisé${currentUser.pdfs_used > 1 ? "s" : ""} ${label}`;

  if (currentUser.plan !== "premium") {
    upgradeBtn.classList.remove("hidden");
    upgradeBtn.classList.add("flex");
  } else {
    upgradeBtn.classList.add("hidden");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Paywall
// ─────────────────────────────────────────────────────────────────────────────
function showPaywall(reason = "upgrade_required") {
  const modal = document.getElementById("paywallModal");
  const title = document.getElementById("paywallTitle");
  const subtitle = document.getElementById("paywallSubtitle");

  if (reason === "quota_exceeded") {
    title.textContent = "Quota mensuel atteint";
    subtitle.textContent = "Tu as utilisé tous tes PDF ce mois-ci. Achète des crédits ou attends le prochain mois.";
  } else if (reason === "premium_required") {
    title.textContent = "Fonctionnalité Premium";
    subtitle.textContent = "Cette fonctionnalité est réservée aux abonnés Premium.";
  } else {
    title.textContent = "Passe à Premium";
    subtitle.textContent = "Tu as atteint la limite du plan gratuit (1 PDF).";
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closePaywall() {
  document.getElementById("paywallModal").classList.add("hidden");
  document.getElementById("paywallModal").classList.remove("flex");
}

async function subscribePremium() {
  try {
    const res = await apiFetch("/billing/subscribe", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else showToast("Erreur Stripe.", "danger");
  } catch (err) {
    if (err.message !== "Non authentifié" && !err.message.includes("required")) {
      showToast("Erreur : " + err.message, "danger");
    }
  }
}

async function buyCredits() {
  try {
    const res = await apiFetch("/billing/credits", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else showToast("Erreur Stripe.", "danger");
  } catch (err) {
    if (err.message !== "Non authentifié" && !err.message.includes("required")) {
      showToast("Erreur : " + err.message, "danger");
    }
  }
}

function showUpgrade() {
  showPaywall("upgrade_required");
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload / generate
// ─────────────────────────────────────────────────────────────────────────────
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  const f = e.dataTransfer.files[0];
  if (f && f.type === "application/pdf") setFile(f);
  else showToast("Seuls les fichiers PDF sont acceptés.", "danger");
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setFile(fileInput.files[0]);
});

function setFile(f) {
  fileInput._file = f;
  document.getElementById("fileChosenName").textContent = f.name;
  document.getElementById("fileChosen").classList.remove("hidden");
  document.getElementById("fileChosen").classList.add("flex");
  dropZone.classList.add("file-chosen");
}

async function handleUpload() {
  const subject = document.getElementById("subjectInput").value.trim() || "Général";
  const textVal = document.getElementById("textInput").value.trim();
  const file = fileInput._file || fileInput.files[0];

  if (!file && !textVal) {
    showToast("Dépose un PDF ou colle du texte.", "warning");
    return;
  }

  showLoading();

  const fd = new FormData();
  fd.append("subject", subject);
  if (file) fd.append("file", file);
  else fd.append("text", textVal);

  try {
    const res = await apiFetch("/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Erreur serveur");

    // Refresh user quota
    await refreshUser();
    currentSessionId = data.session_id;
    await loadAndShowSession(currentSessionId);
    await loadSessions();
  } catch (err) {
    showUpload();
    if (err.message !== "Non authentifié" && err.message !== "upgrade_required" && err.message !== "quota_exceeded") {
      showToast("Erreur : " + err.message, "danger");
    }
  }
}

async function refreshUser() {
  try {
    const res = await fetch(API_BASE + "/auth/me", { credentials: "include" });
    if (res.ok) {
      currentUser = await res.json();
      updateNavbar();
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// Session list
// ─────────────────────────────────────────────────────────────────────────────
async function loadSessions() {
  try {
    const res = await apiFetch("/sessions");
    const sessions = await res.json();
    renderSessionList(sessions);
  } catch {}
}

function renderSessionList(sessions) {
  const elDesktop = document.getElementById("sessionList");
  const elMobile = document.getElementById("sessionListMobile");

  if (!sessions.length) {
    const empty = '<p class="text-slate-400 text-xs text-center mt-4">Aucune session</p>';
    elDesktop.innerHTML = empty;
    if (elMobile) elMobile.innerHTML = empty;
    return;
  }

  const html = sessions
    .map(
      (s) => `
    <div class="session-item ${s.id === currentSessionId ? "active" : ""}" onclick="loadAndShowSession(${s.id})">
      <div class="font-semibold text-sm whitespace-nowrap overflow-hidden text-ellipsis">${escHtml(s.title)}</div>
      <div class="flex justify-between items-center text-xs gap-1 mt-1">
        <span class="bg-violet-100 text-violet-700 text-xs font-semibold px-1.5 py-0.5 rounded-md">${escHtml(s.subject || "Général")}</span>
        <span class="text-slate-400">${formatDate(s.created_at)}</span>
      </div>
      <div class="flex justify-between items-center text-xs gap-1 mt-1">
        <small class="text-slate-400"><i class="bi bi-card-text mr-0.5"></i>${s.qa_count} Q/R &nbsp; <i class="bi bi-journal mr-0.5"></i>${s.summary_count} fiches</small>
        <button class="text-red-400 hover:text-red-600 p-0 transition delete-btn opacity-0"
          style="background:none;border:none;cursor:pointer;"
          onclick="deleteSession(event, ${s.id})">
          <i class="bi bi-trash3"></i>
        </button>
      </div>
    </div>
  `
    )
    .join("");

  elDesktop.innerHTML = html;
  if (elMobile) elMobile.innerHTML = html;

  [elDesktop, elMobile].filter(Boolean).forEach((el) => {
    el.querySelectorAll(".session-item").forEach((item) => {
      const btn = item.querySelector(".delete-btn");
      if (!btn) return;
      item.addEventListener("mouseenter", () => (btn.style.opacity = "1"));
      item.addEventListener("mouseleave", () => (btn.style.opacity = "0"));
    });
  });
}

async function loadAndShowSession(id) {
  showLoading("Chargement de la session…");
  try {
    const res = await apiFetch(`/sessions/${id}`);
    if (!res.ok) throw new Error("Session introuvable");
    const session = await res.json();
    currentSessionId = id;
    renderResults(session);
    loadSessions();
  } catch (err) {
    showUpload();
    if (err.message !== "Non authentifié") showToast(err.message, "danger");
  }
}

async function deleteSession(event, id) {
  event.stopPropagation();
  showConfirm("Supprimer cette session ?", "Toutes les cartes et résumés seront perdus.", async () => {
    await apiFetch(`/sessions/${id}`, { method: "DELETE" });
    if (currentSessionId === id) showUpload();
    await loadSessions();
    showToast("Session supprimée.", "success");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Render results
// ─────────────────────────────────────────────────────────────────────────────
function renderResults(session) {
  currentSession = session;
  document.getElementById("resultsTitle").textContent = session.title;
  document.getElementById("resultsSubtitle").textContent = `${session.subject || "Général"} · ${formatDate(session.created_at)}`;

  const now = new Date();
  const dueCount = session.qa_items.filter((q) => new Date(q.next_review) <= now).length;
  document.getElementById("statsRow").innerHTML = `
    <div class="stat-card">
      <div class="text-3xl font-extrabold leading-none text-violet-600">${session.qa_items.length}</div>
      <div class="text-xs uppercase tracking-wider text-slate-400 mt-1.5">Questions</div>
    </div>
    <div class="stat-card">
      <div class="text-3xl font-extrabold leading-none text-amber-500">${dueCount}</div>
      <div class="text-xs uppercase tracking-wider text-slate-400 mt-1.5">À réviser</div>
    </div>
    <div class="stat-card">
      <div class="text-3xl font-extrabold leading-none text-emerald-500">${session.summaries.length}</div>
      <div class="text-xs uppercase tracking-wider text-slate-400 mt-1.5">Résumés</div>
    </div>
    <div class="stat-card">
      <div class="text-3xl font-extrabold leading-none text-sky-500">${session.qa_items.reduce((a, q) => a + q.review_count, 0)}</div>
      <div class="text-xs uppercase tracking-wider text-slate-400 mt-1.5">Révisions</div>
    </div>
  `;

  document.getElementById("qaTabBadge").textContent = session.qa_items.length;
  document.getElementById("summaryTabBadge").textContent = session.summaries.length;

  const qaCards = document.getElementById("qaCards");
  qaCards.innerHTML = session.qa_items
    .map((q, i) => {
      const due = new Date(q.next_review) <= now;
      const daysLeft = Math.ceil((new Date(q.next_review) - now) / 86400000);
      const badge = due
        ? `<span class="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1"><i class="bi bi-alarm"></i>À réviser</span>`
        : `<span class="bg-emerald-50 text-emerald-600 text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1"><i class="bi bi-check2"></i>${daysLeft}j</span>`;

      const qEsc = escHtml(q.question).replace(/'/g, "&#39;");
      const aEsc = escHtml(q.answer).replace(/'/g, "&#39;");
      return `
    <div class="flashcard" id="fc-${q.id}" onclick="flipCard(${q.id})">
      <div class="flashcard-inner">
        <div class="flashcard-front">
          <div class="flex justify-between items-start mb-1">
            <div class="text-xs font-bold tracking-wider uppercase" style="color:#7c3aed">${i + 1}</div>
            <div class="flex gap-1 card-actions opacity-0 transition-opacity">
              <button class="text-slate-300 hover:text-violet-500 transition p-0.5" onclick="event.stopPropagation(); openEditQaModal(${q.id}, '${qEsc}', '${aEsc}')" title="Modifier">
                <i class="bi bi-pencil text-xs"></i>
              </button>
              <button class="text-slate-300 hover:text-red-400 transition p-0.5" onclick="deleteQa(event, ${q.id})" title="Supprimer">
                <i class="bi bi-trash3 text-xs"></i>
              </button>
            </div>
          </div>
          <div class="text-sm font-semibold leading-snug flex-1">${escHtml(sanitizeMath(q.question))}</div>
          <div class="text-slate-400 text-xs mt-auto pt-2">
            <i class="bi bi-hand-index mr-1"></i>Clique pour voir la réponse
          </div>
        </div>
        <div class="flashcard-back">
          <div class="text-sm leading-relaxed flex-1">${escHtml(sanitizeMath(q.answer))}</div>
          <div class="flex justify-between items-center mt-auto pt-2">
            ${badge}
            <button
              class="border border-violet-300 text-violet-600 hover:bg-violet-50 text-xs px-2 py-1 rounded-lg transition flex items-center gap-1"
              onclick="markReviewed(event, ${q.id})">
              <i class="bi bi-check-lg"></i>Révisé
            </button>
          </div>
        </div>
      </div>
    </div>`;
    })
    .join("");

  const acc = document.getElementById("summaryAccordion");
  acc.innerHTML = session.summaries
    .map(
      (s, i) => `
    <details class="bg-white rounded-2xl overflow-hidden border border-slate-200" ${i === 0 ? "open" : ""}>
      <summary class="flex items-center gap-2.5 px-4 py-3.5 font-semibold cursor-pointer select-none hover:bg-violet-50 transition list-none text-slate-700">
        <i class="bi bi-bookmark-fill text-violet-500 text-xs"></i>
        ${escHtml(s.chapter_title)}
        <i class="bi bi-chevron-down ml-auto details-chevron transition-transform text-slate-400 text-xs"></i>
      </summary>
      <div class="px-4 pb-5 pt-2 summary-content border-t border-slate-100">${escHtml(sanitizeMath(s.content))}</div>
    </details>
  `
    )
    .join("");

  acc.querySelectorAll("details").forEach((det) => {
    det.addEventListener("toggle", () => {
      const chevron = det.querySelector(".details-chevron");
      if (chevron) chevron.style.transform = det.open ? "rotate(180deg)" : "rotate(0deg)";
    });
    const chevron = det.querySelector(".details-chevron");
    if (chevron && det.open) chevron.style.transform = "rotate(180deg)";
  });

  showResults();

  setTimeout(() => {
    if (window.renderMathInElement) {
      const opts = {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
        ],
        throwOnError: false,
        strict: false,
      };
      renderMathInElement(document.getElementById("qaCards"), opts);
      renderMathInElement(document.getElementById("summaryAccordion"), opts);
    }
  }, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flashcard interactions
// ─────────────────────────────────────────────────────────────────────────────
function flipCard(id) {
  const card = document.getElementById(`fc-${id}`);
  if (card) card.classList.toggle("flipped");
}

async function markReviewed(event, id) {
  event.stopPropagation();
  try {
    const res = await apiFetch(`/qa/${id}/review`, { method: "PATCH" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail);
    await loadAndShowSession(currentSessionId);
    showToast("Carte marquée comme révisée !", "success");
  } catch (err) {
    if (err.message !== "Non authentifié") showToast("Erreur : " + err.message, "danger");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────
function showTab(tab) {
  const qaTab = document.getElementById("qaTab");
  const sumTab = document.getElementById("summariesTab");
  const btnQa = document.getElementById("tabBtnQa");
  const btnSum = document.getElementById("tabBtnSummaries");

  if (tab === "qa") {
    qaTab.classList.remove("hidden");
    sumTab.classList.add("hidden");
    btnQa.classList.add("bg-white", "text-slate-900", "shadow-sm");
    btnQa.classList.remove("text-slate-500");
    btnSum.classList.remove("bg-white", "text-slate-900", "shadow-sm");
    btnSum.classList.add("text-slate-500");
  } else {
    qaTab.classList.add("hidden");
    sumTab.classList.remove("hidden");
    btnSum.classList.add("bg-white", "text-slate-900", "shadow-sm");
    btnSum.classList.remove("text-slate-500");
    btnQa.classList.remove("bg-white", "text-slate-900", "shadow-sm");
    btnQa.classList.add("text-slate-500");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────
function exportCSV() {
  if (!currentSessionId) return;
  window.location.href = `/export/${currentSessionId}/csv`;
}

function exportAnki() {
  if (!currentSessionId) return;
  if (!currentUser || currentUser.plan !== "premium") {
    showPaywall("premium_required");
    return;
  }
  window.location.href = `/export/${currentSessionId}/anki`;
}

function exportPDF() {
  if (!currentSessionId) return;
  if (!currentUser || currentUser.plan !== "premium") {
    showPaywall("premium_required");
    return;
  }
  window.location.href = `/export/${currentSessionId}/pdf`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Section visibility helpers
// ─────────────────────────────────────────────────────────────────────────────
const ALL_SECTIONS = ["uploadSection", "loadingSection", "resultsSection", "practiceSection", "manualSection"];
function hideAll() { ALL_SECTIONS.forEach((id) => document.getElementById(id).classList.add("hidden")); }

function showLoading(msg = "L'IA lit ton cours et génère les fiches.") {
  hideAll();
  document.getElementById("loadingSection").classList.remove("hidden");
  document.getElementById("loadingMsg").textContent = msg;
}

function showResults() {
  hideAll();
  document.getElementById("resultsSection").classList.remove("hidden");
}

function showUpload() {
  hideAll();
  document.getElementById("uploadSection").classList.remove("hidden");
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────
function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str || "";
  return d.innerHTML;
}

function sanitizeMath(text) {
  return (text || "").replace(/\$\$?([\s\S]+?)\$?\$/g, (match, inner) => {
    if (/[àâäéèêëîïôùûüçœæÀÂÄÉÈÊËÎÏÔÙÛÜÇŒÆ]/.test(inner)) return inner;
    return match;
  });
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function showToast(message, type = "info") {
  const id = "toast-" + Date.now();
  const colorMap = { success: "bg-green-500", danger: "bg-red-500", warning: "bg-yellow-500", info: "bg-sky-500" };
  const iconMap = { success: "check-circle-fill", danger: "exclamation-triangle-fill", warning: "exclamation-circle-fill", info: "info-circle-fill" };

  document.getElementById("toastContainer").insertAdjacentHTML("beforeend", `
    <div id="${id}" class="${colorMap[type] || "bg-sky-500"} text-white text-sm font-medium px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 max-w-xs">
      <i class="bi bi-${iconMap[type] || "info-circle-fill"} shrink-0"></i>
      <span class="flex-1">${escHtml(message)}</span>
      <button onclick="this.parentElement.remove()" class="ml-2 text-white/70 hover:text-white transition">
        <i class="bi bi-x"></i>
      </button>
    </div>`);

  const el = document.getElementById(id);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Practice Mode
// ─────────────────────────────────────────────────────────────────────────────
let practiceQueue = [];
let practiceTotal = 0;
let practiceCorrect = 0;

function startPractice() {
  if (!currentSession || !currentSession.qa_items.length) {
    showToast("Aucune carte disponible.", "warning");
    return;
  }
  practiceQueue = [...currentSession.qa_items].sort(() => Math.random() - 0.5);
  practiceTotal = practiceQueue.length;
  practiceCorrect = 0;

  hideAll();
  document.getElementById("practiceSection").classList.remove("hidden");
  document.getElementById("practiceEndScreen").classList.add("hidden");
  document.getElementById("practiceCardArea").classList.remove("hidden");
  renderPracticeCard();
}

function renderPracticeCard() {
  const remaining = practiceQueue.length;
  const done = practiceTotal - remaining;
  const pct = (done / practiceTotal) * 100;

  document.getElementById("practiceProgress").textContent =
    `${done} / ${practiceTotal} · ${remaining} restante${remaining > 1 ? "s" : ""}`;
  document.getElementById("practiceProgressBar").style.width = pct + "%";

  if (!remaining) { endPractice(); return; }

  const card = practiceQueue[0];
  document.getElementById("practiceCardArea").innerHTML = `
    <div class="practice-card">
      <div class="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style="color:#7c3aed">
        <i class="bi bi-question-circle"></i>Question
      </div>
      <div class="text-base leading-relaxed flex-1">${escHtml(sanitizeMath(card.question))}</div>

      <div class="mt-3">
        <button class="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1 transition" onclick="togglePracticeAnswer()">
          <i class="bi bi-eye"></i>Voir la réponse
        </button>
        <div id="practiceAnswerBox" class="hidden mt-2">
          <hr class="practice-divider" />
          <div class="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1 text-green-600">
            <i class="bi bi-lightbulb"></i>Réponse
          </div>
          <div class="text-base leading-relaxed">${escHtml(sanitizeMath(card.answer))}</div>
        </div>
      </div>

      <div class="flex gap-2 mt-auto pt-4">
        <button class="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center justify-center gap-1" onclick="answerPractice(false)">
          <i class="bi bi-x-lg"></i>Je ne savais pas
        </button>
        <button class="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-2 rounded-lg transition flex items-center justify-center gap-1" onclick="answerPractice(true)">
          <i class="bi bi-check-lg"></i>Je savais !
        </button>
      </div>
    </div>`;

  setTimeout(() => {
    if (window.renderMathInElement) {
      renderMathInElement(document.getElementById("practiceCardArea"), {
        delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
        throwOnError: false, strict: false,
      });
    }
  }, 50);
}

function togglePracticeAnswer() {
  const box = document.getElementById("practiceAnswerBox");
  box.classList.toggle("hidden");
  if (window.renderMathInElement && !box.classList.contains("hidden")) {
    renderMathInElement(box, {
      delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }],
      throwOnError: false, strict: false,
    });
  }
}

function answerPractice(knew) {
  const card = practiceQueue.shift();
  if (knew) {
    practiceCorrect++;
    apiFetch(`/qa/${card.id}/review`, { method: "PATCH" }).catch(() => {});
  } else {
    practiceQueue.push(card);
  }
  renderPracticeCard();
}

function endPractice() {
  document.getElementById("practiceCardArea").classList.add("hidden");
  document.getElementById("practiceProgressBar").style.width = "100%";
  document.getElementById("practiceProgress").textContent = `${practiceTotal} / ${practiceTotal} cartes`;

  const pct = Math.round((practiceCorrect / practiceTotal) * 100);
  const emoji = pct >= 80 ? "🏆" : pct >= 50 ? "💪" : "📚";
  document.getElementById("practiceEndEmoji").textContent = emoji;
  document.getElementById("practiceEndStats").textContent =
    `${practiceCorrect} sur ${practiceTotal} cartes réussies — ${pct}% de réussite`;
  document.getElementById("practiceEndScreen").classList.remove("hidden");
}

function closePractice() {
  document.getElementById("practiceSection").classList.add("hidden");
  document.getElementById("resultsSection").classList.remove("hidden");
  if (currentSessionId) loadAndShowSession(currentSessionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm modal
// ─────────────────────────────────────────────────────────────────────────────
let confirmCallback = null;

function showConfirm(title, message, onOk) {
  confirmCallback = onOk;
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = message;
  document.getElementById("confirmModal").classList.remove("hidden");
  document.getElementById("confirmModal").classList.add("flex");
}

function confirmOk() {
  document.getElementById("confirmModal").classList.add("hidden");
  document.getElementById("confirmModal").classList.remove("flex");
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
}

function confirmCancel() {
  document.getElementById("confirmModal").classList.add("hidden");
  document.getElementById("confirmModal").classList.remove("flex");
  confirmCallback = null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual mode
// ─────────────────────────────────────────────────────────────────────────────
function showManual() {
  hideAll();
  document.getElementById("manualSection").classList.remove("hidden");
}

async function createManualSession() {
  const title = document.getElementById("manualTitle").value.trim();
  const subject = document.getElementById("manualSubject").value.trim() || "Général";
  if (!title) { showToast("Entre un titre.", "warning"); return; }

  const fd = new FormData();
  fd.append("title", title);
  fd.append("subject", subject);

  try {
    const res = await apiFetch("/sessions/manual", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { showToast("Erreur : " + data.detail, "danger"); return; }

    currentSessionId = data.session_id;
    await loadAndShowSession(currentSessionId);
    await loadSessions();
    showToast("Deck créé ! Ajoute tes cartes.", "success");
  } catch (err) {
    if (err.message !== "Non authentifié") showToast("Erreur : " + err.message, "danger");
  }
}

// ─────────────────────────────────────────��───────────────────────────────────
// Q/R Modal (add & edit)
// ─────────────────────────────────────────────────────────────────────────────
let qaModalMode = "add";
let qaModalEditId = null;

function openAddQaModal() {
  if (!currentSessionId) { showToast("Ouvre d'abord une session.", "warning"); return; }
  qaModalMode = "add";
  qaModalEditId = null;
  document.getElementById("qaModalTitle").textContent = "Ajouter une carte";
  document.getElementById("qaModalQuestion").value = "";
  document.getElementById("qaModalAnswer").value = "";
  document.getElementById("qaModal").classList.remove("hidden");
  document.getElementById("qaModal").classList.add("flex");
  document.getElementById("qaModalQuestion").focus();
}

function openEditQaModal(id, question, answer) {
  qaModalMode = "edit";
  qaModalEditId = id;
  document.getElementById("qaModalTitle").textContent = "Modifier la carte";
  document.getElementById("qaModalQuestion").value = question;
  document.getElementById("qaModalAnswer").value = answer;
  document.getElementById("qaModal").classList.remove("hidden");
  document.getElementById("qaModal").classList.add("flex");
  document.getElementById("qaModalQuestion").focus();
}

function closeQaModal() {
  document.getElementById("qaModal").classList.add("hidden");
  document.getElementById("qaModal").classList.remove("flex");
}

async function submitQaModal() {
  const question = document.getElementById("qaModalQuestion").value.trim();
  const answer = document.getElementById("qaModalAnswer").value.trim();
  if (!question || !answer) { showToast("Remplis la question et la réponse.", "warning"); return; }

  try {
    if (qaModalMode === "add") {
      const res = await apiFetch(`/sessions/${currentSessionId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      if (!res.ok) { showToast("Erreur lors de l'ajout.", "danger"); return; }
      showToast("Carte ajoutée !", "success");
    } else {
      const res = await apiFetch(`/qa/${qaModalEditId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer }),
      });
      if (!res.ok) { showToast("Erreur lors de la modification.", "danger"); return; }
      showToast("Carte modifiée !", "success");
    }
    closeQaModal();
    await loadAndShowSession(currentSessionId);
  } catch (err) {
    if (err.message !== "Non authentifié") showToast("Erreur : " + err.message, "danger");
  }
}

async function deleteQa(event, id) {
  event.stopPropagation();
  showConfirm("Supprimer cette carte ?", "Cette action est irréversible.", async () => {
    try {
      const res = await apiFetch(`/qa/${id}`, { method: "DELETE" });
      if (!res.ok) { showToast("Erreur lors de la suppression.", "danger"); return; }
      showToast("Carte supprimée.", "success");
      await loadAndShowSession(currentSessionId);
    } catch {}
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Expose to inline onclick handlers
// ─────────────────────────────────────────────────────────────────────────────
window.handleUpload = handleUpload;
window.loadSessions = loadSessions;
window.loadAndShowSession = loadAndShowSession;
window.deleteSession = deleteSession;
window.flipCard = flipCard;
window.markReviewed = markReviewed;
window.showTab = showTab;
window.exportCSV = exportCSV;
window.exportAnki = exportAnki;
window.exportPDF = exportPDF;
window.showUpload = showUpload;
window.showManual = showManual;
window.startPractice = startPractice;
window.renderPracticeCard = renderPracticeCard;
window.togglePracticeAnswer = togglePracticeAnswer;
window.answerPractice = answerPractice;
window.closePractice = closePractice;
window.confirmOk = confirmOk;
window.confirmCancel = confirmCancel;
window.createManualSession = createManualSession;
window.openAddQaModal = openAddQaModal;
window.openEditQaModal = openEditQaModal;
window.closeQaModal = closeQaModal;
window.submitQaModal = submitQaModal;
window.deleteQa = deleteQa;
window.showAuthModal = showAuthModal;
window.switchAuthTab = switchAuthTab;
window.submitAuth = submitAuth;
window.logout = logout;
window.showPaywall = showPaywall;
window.closePaywall = closePaywall;
window.subscribePremium = subscribePremium;
window.buyCredits = buyCredits;
window.showUpgrade = showUpgrade;

// ─────────────────────────────────────────────────────────────────────────────
// Init — check auth before showing anything
// ─────────────────────────────────────────────────────────────────────────────
async function initApp() {
  // Handle Stripe return params
  const params = new URLSearchParams(window.location.search);
  if (params.has("subscribed")) {
    history.replaceState({}, "", "/");
    showToast("Abonnement Premium activé ! Merci 🎉", "success");
  } else if (params.has("credits")) {
    history.replaceState({}, "", "/");
    showToast("5 crédits ajoutés à ton compte !", "success");
  }

  try {
    const res = await fetch(API_BASE + "/auth/me", { credentials: "include" });
    if (res.ok) {
      currentUser = await res.json();
      hideAuthModal();
      updateNavbar();
      await loadSessions();
    } else {
      showAuthModal("login");
    }
  } catch {
    showAuthModal("login");
  }
}

initApp();
