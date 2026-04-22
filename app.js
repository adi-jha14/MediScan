/**
 * app.js — MediScan AI (Apple-Inspired Edition)
 */

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  apiKey: "",
  currentFile: null,
  isLoading: false,
  sessions: [],
  activeSessionId: null,
};

const LS_SESSIONS = "mediscan_sessions";
const LS_APIKEY   = "mediscan_apikey";
const MAX_SESS    = 50;

// ─── DOM ────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const els = {
  apiKeyInput:       $("api-key-input"),
  toggleApiKey:      $("toggle-api-key"),
  saveApiKey:        $("save-api-key"),
  apiKeyStatus:      $("api-key-status"),
  dropZone:          $("drop-zone"),
  fileInput:         $("file-input"),
  imagePreview:      $("image-preview"),
  previewImg:        $("preview-img"),
  previewName:       $("preview-name"),
  previewSize:       $("preview-size"),
  removeImage:       $("remove-image"),
  compressionNote:   $("compression-note"),
  symptomsInput:     $("symptoms-input"),
  charCount:         $("char-count"),
  analyzeBtn:        $("analyze-btn"),
  analyzeBtnText:    $("analyze-btn-text"),
  analyzeBtnSpinner: $("analyze-btn-spinner"),
  loadingOverlay:    $("loading-overlay"),
  resultsSection:    $("results-section"),
  resultsContainer:  $("results-container"),
  exportPdfBtn:      $("export-pdf-btn"),
  historyList:       $("history-list"),
  clearHistoryBtn:   $("clear-history-btn"),
  sidebarToggle:     $("sidebar-toggle"),
  sidebar:           $("sidebar"),
  mainOverlay:       $("main-overlay"),
  toastContainer:    $("toast-container"),
  errorBanner:       $("error-banner"),
  errorMsg:          $("error-msg"),
  errorClose:        $("error-close"),
  pageLoader:        $("page-loader"),
};

// ─── Init ────────────────────────────────────────────────────────────────────
function init() {
  setTimeout(() => els.pageLoader.classList.add("fade-out"), 1100);

  const builtinKey = (typeof HARDCODED_API_KEY !== "undefined" && HARDCODED_API_KEY)
    ? HARDCODED_API_KEY : "";
  const savedKey = localStorage.getItem(LS_APIKEY) || "";
  state.apiKey = builtinKey || savedKey;

  if (state.apiKey && els.apiKeyInput) {
    els.apiKeyInput.value = state.apiKey;
    showApiKeyStatus("Key loaded ✓", "success");
  }

  loadSessions();
  renderHistory();
  attachEventListeners();
}

// ─── API Key ─────────────────────────────────────────────────────────────────
function saveApiKey() {
  const key = els.apiKeyInput.value.trim();

  if (!key) {
    showApiKeyStatus("Enter an API key", "error");
    return;
  }
  // Google API keys: start with "AIza", exactly 39 chars, alphanumeric + _-
  if (!key.startsWith("AIza") || key.length !== 39 || !/^[A-Za-z0-9_\-]+$/.test(key)) {
    showApiKeyStatus("Invalid key — must start with 'AIza' and be 39 characters", "error");
    els.apiKeyInput.focus();
    els.apiKeyInput.select();
    return;
  }

  state.apiKey = key;
  localStorage.setItem(LS_APIKEY, key);
  showApiKeyStatus("Saved ✓", "success");
  showToast("API key saved", "success");
}

function showApiKeyStatus(msg, type) {
  if (!els.apiKeyStatus) return;
  els.apiKeyStatus.textContent = msg;
  els.apiKeyStatus.className = "api-key-status " + type;
  els.apiKeyStatus.style.display = "block";
  setTimeout(() => { els.apiKeyStatus.style.display = "none"; }, 2800);
}

// ─── Session History ──────────────────────────────────────────────────────────
function loadSessions() {
  try { state.sessions = JSON.parse(localStorage.getItem(LS_SESSIONS) || "[]"); }
  catch (_) { state.sessions = []; }
}

function saveSessions() {
  if (state.sessions.length > MAX_SESS) state.sessions = state.sessions.slice(0, MAX_SESS);
  localStorage.setItem(LS_SESSIONS, JSON.stringify(state.sessions));
}

function addSession(resultData, rawText) {
  const id = Date.now().toString();
  state.sessions.unshift({
    id, timestamp: new Date().toISOString(),
    document_type: resultData?.document_type || "Unknown",
    severity: resultData?.severity_indicator || "—",
    summary: (resultData?.summary || rawText || "No summary.").substring(0, 100),
    fullData: resultData || null,
    rawText: rawText || null,
  });
  state.activeSessionId = id;
  saveSessions();
  renderHistory();
}

function renderHistory() {
  if (!state.sessions.length) {
    els.historyList.innerHTML = '<li class="history-empty">No scans yet.</li>';
    return;
  }
  els.historyList.innerHTML = state.sessions.map((s) => {
    const d   = new Date(s.timestamp);
    const ago = timeAgo(d);
    const sev = (s.severity || "").toLowerCase();
    const dotClass = sev === "urgent" ? "h-dot h-dot-urg"
                   : sev === "high"   ? "h-dot h-dot-hi"
                   : sev === "moderate" ? "h-dot h-dot-mod"
                   : "h-dot h-dot-low";
    return `<li class="history-item ${s.id === state.activeSessionId ? "active" : ""}"
                data-id="${s.id}" role="button" tabindex="0">
      <div class="${dotClass}"></div>
      <div class="h-text">
        <div class="h-name">${escHtml(s.document_type)}</div>
        <div class="h-time">${ago} · ${escHtml(s.severity)}</div>
      </div>
    </li>`;
  }).join("");

  els.historyList.querySelectorAll(".history-item").forEach((el) => {
    el.addEventListener("click",   () => loadSession(el.dataset.id));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") loadSession(el.dataset.id); });
  });
}

function loadSession(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) return;
  state.activeSessionId = id;
  renderHistory();
  if (s.fullData) renderStructuredResult(s.fullData);
  else if (s.rawText) renderRawResult(s.rawText);
  if (window.innerWidth < 768) closeSidebar();
  els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearHistory() {
  if (!state.sessions.length) return;
  if (!confirm("Clear all scan history?")) return;
  state.sessions = []; state.activeSessionId = null;
  localStorage.removeItem(LS_SESSIONS);
  renderHistory();
  els.resultsSection.style.display = "none";
  showToast("History cleared", "info");
}

// ─── Image Handling ───────────────────────────────────────────────────────────
function handleFile(file) {
  if (!file) return;
  const allowed = ["image/jpeg","image/png","image/gif","image/webp","image/bmp"];
  if (!allowed.includes(file.type)) {
    showError("Unsupported file type. Please upload JPEG, PNG, WebP, GIF, or BMP.");
    return;
  }
  state.currentFile = file;
  const sizeMB = file.size / (1024 * 1024);
  els.previewName.textContent = file.name;
  els.previewSize.textContent = sizeMB >= 1 ? `${sizeMB.toFixed(2)} MB` : `${(file.size/1024).toFixed(1)} KB`;
  els.compressionNote.style.display = sizeMB > 4 ? "flex" : "none";
  els.previewImg.src = URL.createObjectURL(file);
  els.imagePreview.style.display = "flex";
  els.dropZone.classList.add("has-file");
}

function removeImage() {
  state.currentFile = null;
  els.previewImg.src = "";
  els.imagePreview.style.display = "none";
  els.dropZone.classList.remove("has-file");
  els.fileInput.value = "";
  els.compressionNote.style.display = "none";
}

function shakeTextarea() {
  const ta = els.symptomsInput;
  ta.classList.remove("input-error");
  void ta.offsetWidth;
  ta.classList.add("input-error");
  ta.focus();
  ta.addEventListener("animationend", () => ta.classList.remove("input-error"), { once: true });
}

// ─── Analysis ─────────────────────────────────────────────────────────────────
async function runAnalysis() {
  const text = els.symptomsInput.value.trim();

  if (!state.apiKey) {
    showError("Please enter your Gemini API key in the sidebar.");
    els.apiKeyInput?.focus();
    return;
  }
  if (!state.currentFile && !text) {
    showError("Please upload a medical document or describe your symptoms.");
    shakeTextarea();
    return;
  }
  if (!state.currentFile && text.length < 10) {
    showError("Description too short — please be more specific (minimum 10 characters).");
    shakeTextarea();
    return;
  }
  if (!state.currentFile && text.replace(/[^a-zA-Z]/g, "").length < 3) {
    showError("Please enter a valid symptom description or medicine name.");
    shakeTextarea();
    return;
  }

  setLoading(true);
  clearError();

  try {
    let base64 = null, mimeType = null;
    if (state.currentFile) {
      const r = await processImage(state.currentFile);
      base64 = r.base64; mimeType = r.mimeType;
      if (r.wasCompressed) showToast("Image compressed to stay under 4 MB", "info");
    }

    const res = await analyzeWithGemini(state.apiKey, base64, mimeType, text);

    if (res.success) {
      renderStructuredResult(res.data);
      addSession(res.data, null);
    } else {
      renderRawResult(res.rawText);
      addSession(null, res.rawText);
    }

    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    if (err.message === "MISSING_API_KEY") showError("Please enter your Gemini API key.");
    else showError(err.message || "An unexpected error occurred. Please try again.");
  } finally {
    setLoading(false);
  }
}

function setLoading(on) {
  state.isLoading = on;
  els.analyzeBtn.disabled = on;
  els.analyzeBtnText.textContent = on ? "Analyzing…" : "Analyze";
  els.analyzeBtnSpinner.style.display = on ? "inline-block" : "none";
  els.loadingOverlay.style.display  = on ? "flex" : "none";
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
function exportAsPDF() { window.print(); }

// ─── Result Rendering ─────────────────────────────────────────────────────────
function renderStructuredResult(data) {
  els.resultsSection.style.display = "block";

  const sevClass = getSevClass(data.severity_indicator);

  const findingsHtml = (data.key_findings || []).length
    ? `<ul class="findings-list">${data.key_findings.map(f =>
        `<li class="finding-item">${escHtml(f)}</li>`).join("")}</ul>`
    : `<p class="ps-body" style="font-style:italic">No key findings reported.</p>`;

  const flaggedHtml = renderFlaggedItems(data.flagged_items);

  const questionsHtml = (data.doctor_questions || []).length
    ? `<ol class="doctor-list">${data.doctor_questions.map((q, i) =>
        `<li class="doctor-item"><span class="doctor-num">0${i+1}</span><span class="doctor-q">${escHtml(q)}</span></li>`
      ).join("")}</ol>`
    : `<p class="ps-body" style="font-style:italic">No questions generated.</p>`;

  els.resultsContainer.innerHTML = `
    <div class="result-panel animate-in">

      <div class="result-meta-row">
        <span class="meta-chip chip-type">${escHtml(data.document_type || "Unknown")}</span>
        <span class="meta-chip chip-sev-${sevClass}">${escHtml(data.severity_indicator || "—")}</span>
      </div>

      <div class="panel-section">
        <div class="ps-label">Summary</div>
        <p class="ps-body">${escHtml(data.summary || "No summary provided.")}</p>
      </div>

      <div class="panel-divider"></div>

      <div class="panel-section">
        <div class="ps-label">Key Findings</div>
        ${findingsHtml}
      </div>

      <div class="panel-divider"></div>

      <div class="panel-section">
        <div class="ps-label">Flagged Items</div>
        ${flaggedHtml}
      </div>

      <div class="panel-divider"></div>

      <div class="panel-section">
        <div class="ps-label">Questions to ask your doctor</div>
        ${questionsHtml}
      </div>

      <div class="disclaimer-section">
        <p class="disclaimer-text">${escHtml(data.disclaimer || "This is AI-generated information only. Always consult a qualified medical professional.")}</p>
      </div>

    </div>`;
}

function renderFlaggedItems(items) {
  if (!items || !items.length) {
    return `<p class="ps-body" style="font-style:italic">No flagged items — everything appears within normal range.</p>`;
  }
  return `<div class="flagged-list">${items.map((fi) => {
    const sev = (fi.severity || "low").toLowerCase();
    const dotCls = sev === "high" ? "fdot-high" : sev === "medium" ? "fdot-medium" : "fdot-low";
    const tagCls = sev === "high" ? "fsev-high" : sev === "medium" ? "fsev-medium" : "fsev-low";
    return `<div class="flagged-item">
      <div class="flagged-dot ${dotCls}"></div>
      <div class="flagged-content">
        <div class="flagged-name">${escHtml(fi.item || "Unknown")}</div>
        <div class="flagged-reason">${escHtml(fi.reason || "")}</div>
        <span class="flagged-sev-tag ${tagCls}">${cap(sev)}</span>
      </div>
    </div>`;
  }).join("")}</div>`;
}

function renderRawResult(rawText) {
  els.resultsSection.style.display = "block";
  els.resultsContainer.innerHTML = `
    <div class="result-panel animate-in">
      <div class="panel-section">
        <div class="ps-label">Analysis Result</div>
        <p class="ps-body raw-text">${escHtml(rawText)}</p>
      </div>
      <div class="disclaimer-section">
        <p class="disclaimer-text">This is AI-generated information only. Always consult a qualified medical professional.</p>
      </div>
    </div>`;
}

// ─── Error / Toast ─────────────────────────────────────────────────────────────
function showError(msg) {
  els.errorMsg.textContent = msg;
  els.errorBanner.style.display = "flex";
  els.errorBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function clearError() {
  els.errorBanner.style.display = "none";
  els.errorMsg.textContent = "";
}

function showToast(msg, type = "info") {
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.setAttribute("role", "status");
  t.textContent = msg;
  els.toastContainer.appendChild(t);
  requestAnimationFrame(() => t.classList.add("toast-show"));
  setTimeout(() => {
    t.classList.remove("toast-show");
    t.addEventListener("transitionend", () => t.remove());
  }, 3000);
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function openSidebar() {
  els.sidebar.classList.add("open");
  els.mainOverlay.style.display = "block";
  requestAnimationFrame(() => els.mainOverlay.classList.add("visible"));
}
function closeSidebar() {
  els.sidebar.classList.remove("open");
  els.mainOverlay.classList.remove("visible");
  setTimeout(() => { if (!els.sidebar.classList.contains("open")) els.mainOverlay.style.display = "none"; }, 250);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getSevClass(s) {
  switch ((s || "").toLowerCase()) {
    case "low": return "low"; case "moderate": return "moderate";
    case "high": return "high"; case "urgent": return "urgent";
    default: return "low";
  }
}

function escHtml(s) {
  if (typeof s !== "string") return String(s || "");
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
          .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

function timeAgo(date) {
  const diff = Math.floor((Date.now() - date) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function attachEventListeners() {
  // API Key
  els.saveApiKey.addEventListener("click", saveApiKey);
  els.apiKeyInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveApiKey(); });
  els.toggleApiKey.addEventListener("click", () => {
    const show = els.apiKeyInput.type === "password";
    els.apiKeyInput.type = show ? "text" : "password";
    els.toggleApiKey.setAttribute("aria-label", show ? "Hide key" : "Show key");
  });

  // Hero CTA
  document.getElementById("hero-cta-btn")?.addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
  });

  // Drop Zone
  els.dropZone.addEventListener("click", (e) => {
    if (!els.imagePreview.style.display || els.imagePreview.style.display === "none") {
      if (!e.target.closest("#image-preview")) els.fileInput.click();
    }
  });
  els.fileInput.addEventListener("change", (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
  els.dropZone.addEventListener("dragover", (e) => { e.preventDefault(); els.dropZone.classList.add("drag-over"); });
  els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("drag-over"));
  els.dropZone.addEventListener("drop", (e) => {
    e.preventDefault(); els.dropZone.classList.remove("drag-over");
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  });

  // Remove image
  els.removeImage.addEventListener("click", (e) => { e.stopPropagation(); removeImage(); });

  // Char count
  els.symptomsInput.addEventListener("input", () => {
    const n = els.symptomsInput.value.length;
    els.charCount.textContent = `${n} / 2000`;
    els.charCount.style.color = n > 1900 ? "#ff3b30" : "";
  });

  // Analyze
  els.analyzeBtn.addEventListener("click", runAnalysis);

  // PDF Export
  els.exportPdfBtn.addEventListener("click", exportAsPDF);

  // Error dismiss
  els.errorClose.addEventListener("click", clearError);

  // History
  els.clearHistoryBtn.addEventListener("click", clearHistory);

  // Mobile sidebar
  els.sidebarToggle.addEventListener("click", openSidebar);
  els.mainOverlay.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSidebar(); });

  // Clipboard paste
  document.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const f = item.getAsFile();
        if (f) { handleFile(f); showToast("Image pasted from clipboard", "success"); }
        break;
      }
    }
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
