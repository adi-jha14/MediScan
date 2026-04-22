/**
 * app.js — MediScan AI (Professional Edition)
 * Core application logic, UI, session history, PDF export.
 */

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  apiKey: "",
  currentFile: null,
  isLoading: false,
  sessions: [],
  activeSessionId: null,
};

const LS_KEY_SESSIONS = "mediscan_sessions";
const LS_KEY_APIKEY   = "mediscan_apikey";
const MAX_SESSIONS    = 50;

// ─── DOM References ───────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  // API Key
  apiKeyInput:       $("api-key-input"),
  toggleApiKey:      $("toggle-api-key"),
  saveApiKey:        $("save-api-key"),
  apiKeyStatus:      $("api-key-status"),
  // Upload
  dropZone:          $("drop-zone"),
  fileInput:         $("file-input"),
  imagePreview:      $("image-preview"),
  previewImg:        $("preview-img"),
  previewName:       $("preview-name"),
  previewSize:       $("preview-size"),
  removeImage:       $("remove-image"),
  compressionNote:   $("compression-note"),
  // Input
  symptomsInput:     $("symptoms-input"),
  charCount:         $("char-count"),
  // Analyze
  analyzeBtn:        $("analyze-btn"),
  analyzeBtnText:    $("analyze-btn-text"),
  analyzeBtnSpinner: $("analyze-btn-spinner"),
  // Results
  loadingOverlay:    $("loading-overlay"),
  resultsSection:    $("results-section"),
  resultsContainer:  $("results-container"),
  exportPdfBtn:      $("export-pdf-btn"),
  // Sidebar / History
  historyList:       $("history-list"),
  clearHistoryBtn:   $("clear-history-btn"),
  sidebarToggle:     $("sidebar-toggle"),
  sidebar:           $("sidebar"),
  mainOverlay:       $("main-overlay"),
  // Misc
  toastContainer:    $("toast-container"),
  errorBanner:       $("error-banner"),
  errorMsg:          $("error-msg"),
  errorClose:        $("error-close"),
  pageLoader:        $("page-loader"),
};

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  // Fade out the page loader after a brief branded moment
  setTimeout(() => {
    els.pageLoader.classList.add("fade-out");
  }, 1300);

  // Load API key: prefer hardcoded (if set), fall back to localStorage
  const builtinKey = (typeof HARDCODED_API_KEY !== "undefined" && HARDCODED_API_KEY)
    ? HARDCODED_API_KEY : "";
  const savedKey = localStorage.getItem(LS_KEY_APIKEY) || "";
  state.apiKey = builtinKey || savedKey;

  if (state.apiKey && els.apiKeyInput) {
    els.apiKeyInput.value = state.apiKey;
    showApiKeyStatus("Key loaded ✓", "success");
  }

  loadSessions();
  renderHistory();
  attachEventListeners();
}

// ─── API Key ──────────────────────────────────────────────────────────────────
function saveApiKey() {
  const key = els.apiKeyInput.value.trim();
  if (!key) {
    showApiKeyStatus("Please enter a valid API key", "error");
    return;
  }
  state.apiKey = key;
  localStorage.setItem(LS_KEY_APIKEY, key);
  showApiKeyStatus("Key saved ✓", "success");
  showToast("API key saved!", "success");
}

function showApiKeyStatus(msg, type) {
  if (!els.apiKeyStatus) return;
  els.apiKeyStatus.textContent = msg;
  els.apiKeyStatus.className = "api-key-status " + type;
  els.apiKeyStatus.style.display = "block";
  setTimeout(() => { els.apiKeyStatus.style.display = "none"; }, 3000);
}

// ─── Session History ──────────────────────────────────────────────────────────
function loadSessions() {
  try {
    const raw = localStorage.getItem(LS_KEY_SESSIONS);
    state.sessions = raw ? JSON.parse(raw) : [];
  } catch (_) { state.sessions = []; }
}

function saveSessions() {
  if (state.sessions.length > MAX_SESSIONS) {
    state.sessions = state.sessions.slice(0, MAX_SESSIONS);
  }
  localStorage.setItem(LS_KEY_SESSIONS, JSON.stringify(state.sessions));
}

function addSession(resultData, rawText) {
  const id = Date.now().toString();
  const session = {
    id,
    timestamp: new Date().toISOString(),
    document_type: resultData?.document_type || "Unknown",
    severity: resultData?.severity_indicator || "—",
    summary: resultData?.summary
      ? resultData.summary.substring(0, 100) + (resultData.summary.length > 100 ? "…" : "")
      : rawText ? rawText.substring(0, 100) + "…" : "No summary.",
    fullData: resultData || null,
    rawText: rawText || null,
  };
  state.sessions.unshift(session);
  state.activeSessionId = id;
  saveSessions();
  renderHistory();
}

function renderHistory() {
  if (!state.sessions.length) {
    els.historyList.innerHTML = '<li class="history-empty">No scans yet.<br/>Upload a document to get started.</li>';
    return;
  }

  els.historyList.innerHTML = state.sessions.map((s) => {
    const date = new Date(s.timestamp);
    const timeStr =
      date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
      " " + date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const isActive = s.id === state.activeSessionId;
    const sevClass = getSeverityClass(s.severity);

    return `
      <li class="history-item ${isActive ? "active" : ""}" data-id="${s.id}" role="button" tabindex="0">
        <div class="history-header">
          <span class="history-doc-type">${escapeHtml(s.document_type)}</span>
          <span class="severity-badge severity-${sevClass} severity-sm">${escapeHtml(s.severity)}</span>
        </div>
        <div class="history-summary">${escapeHtml(s.summary)}</div>
        <div class="history-time">${timeStr}</div>
      </li>`;
  }).join("");

  els.historyList.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", () => loadSession(item.dataset.id));
    item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") loadSession(item.dataset.id); });
  });
}

function loadSession(id) {
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return;
  state.activeSessionId = id;
  renderHistory();
  if (session.fullData) renderStructuredResult(session.fullData);
  else if (session.rawText) renderRawResult(session.rawText);
  if (window.innerWidth < 768) closeSidebar();
  els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearHistory() {
  if (!state.sessions.length) return;
  if (!confirm("Clear all scan history? This cannot be undone.")) return;
  state.sessions = [];
  state.activeSessionId = null;
  localStorage.removeItem(LS_KEY_SESSIONS);
  renderHistory();
  els.resultsSection.style.display = "none";
  showToast("History cleared", "info");
}

// ─── Image Handling ───────────────────────────────────────────────────────────
function handleFile(file) {
  if (!file) return;
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
  if (!allowed.includes(file.type)) {
    showError("Unsupported file type. Please upload JPEG, PNG, WebP, GIF, or BMP.");
    return;
  }
  state.currentFile = file;
  const sizeMB = file.size / (1024 * 1024);
  els.previewName.textContent = file.name;
  els.previewSize.textContent = sizeMB >= 1 ? `${sizeMB.toFixed(2)} MB` : `${(file.size / 1024).toFixed(1)} KB`;
  els.compressionNote.style.display = sizeMB > 4 ? "block" : "none";
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
  ta.classList.remove("input-error"); // reset if already shaking
  // Force reflow so the animation restarts cleanly
  void ta.offsetWidth;
  ta.classList.add("input-error");
  ta.focus();
  ta.addEventListener("animationend", () => ta.classList.remove("input-error"), { once: true });
}

// ─── Analysis ─────────────────────────────────────────────────────────────────
async function runAnalysis() {
  const text = els.symptomsInput.value.trim();

  // 1. API key guard
  if (!state.apiKey) {
    showError("Please enter your Gemini API key in the sidebar to continue.");
    els.apiKeyInput?.focus();
    return;
  }

  // 2. Must have at least one input (image OR text)
  if (!state.currentFile && !text) {
    showError("Please upload a medical document or describe your symptoms before analyzing.");
    shakeTextarea();
    return;
  }

  // 3. Text-only submissions need a minimum of 10 meaningful characters
  if (!state.currentFile && text.length < 10) {
    showError("Your description is too short. Please provide at least a brief description of your symptoms or medicine name (minimum 10 characters).");
    shakeTextarea();
    return;
  }

  // 4. Reject obvious gibberish — text must contain at least 3 alphabetic characters
  if (!state.currentFile && (text.replace(/[^a-zA-Z]/g, "").length < 3)) {
    showError("Please enter a valid symptom description or medicine name. Numbers and symbols alone cannot be analyzed.");
    shakeTextarea();
    return;
  }


  setLoading(true);
  clearError();

  try {
    let base64 = null, mimeType = null;

    if (state.currentFile) {
      const result = await processImage(state.currentFile);
      base64 = result.base64;
      mimeType = result.mimeType;
      if (result.wasCompressed) showToast("Image compressed to stay under 4 MB.", "info");
    }

    const apiResult = await analyzeWithGemini(state.apiKey, base64, mimeType, text);

    if (apiResult.success) {
      renderStructuredResult(apiResult.data);
      addSession(apiResult.data, null);
    } else {
      renderRawResult(apiResult.rawText);
      addSession(null, apiResult.rawText);
    }

    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    if (err.message === "MISSING_API_KEY") {
      showError("Please enter your Gemini API key in the sidebar.");
    } else {
      showError(err.message || "An unexpected error occurred. Please try again.");
    }
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
  els.analyzeBtn.disabled = isLoading;
  els.analyzeBtnText.textContent = isLoading ? "Analyzing…" : "Analyze";
  els.analyzeBtnSpinner.style.display = isLoading ? "inline-block" : "none";
  els.loadingOverlay.style.display = isLoading ? "flex" : "none";
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
function exportAsPDF() {
  window.print();
}

// ─── Result Rendering ─────────────────────────────────────────────────────────
function renderStructuredResult(data) {
  els.resultsSection.style.display = "block";
  const sevClass = getSeverityClass(data.severity_indicator);

  els.resultsContainer.innerHTML = `
    <div class="result-card result-header-card animate-in">
      <div class="result-header-top">
        <div>
          <div class="card-label">Document Type</div>
          <h2 class="doc-type-title">${escapeHtml(data.document_type || "Unknown")}</h2>
        </div>
        <div class="severity-badge severity-${sevClass} ${sevClass === "urgent" ? "severity-urgent-pulse" : ""}">
          <span class="severity-dot"></span>${escapeHtml(data.severity_indicator || "—")}
        </div>
      </div>
    </div>

    <div class="result-card animate-in" style="animation-delay:.05s">
      <div class="card-icon">📋</div>
      <div class="card-label">Summary</div>
      <p class="card-body">${escapeHtml(data.summary || "No summary provided.")}</p>
    </div>

    <div class="result-card animate-in" style="animation-delay:.1s">
      <div class="card-icon">🔍</div>
      <div class="card-label">Key Findings</div>
      <ul class="findings-list">
        ${(data.key_findings || []).length
          ? data.key_findings.map((f) => `<li class="finding-item">${escapeHtml(f)}</li>`).join("")
          : '<li class="finding-item muted">No key findings reported.</li>'}
      </ul>
    </div>

    ${renderFlaggedItems(data.flagged_items)}

    <div class="result-card animate-in" style="animation-delay:.2s">
      <div class="card-icon">💬</div>
      <div class="card-label">Questions to Ask Your Doctor</div>
      <ol class="doctor-questions-list">
        ${(data.doctor_questions || []).length
          ? data.doctor_questions.map((q) => `<li class="doctor-question">${escapeHtml(q)}</li>`).join("")
          : '<li class="doctor-question muted">No questions generated.</li>'}
      </ol>
    </div>

    <div class="result-card disclaimer-card animate-in" style="animation-delay:.25s">
      <div class="disclaimer-icon">⚠️</div>
      <p class="disclaimer-text">${escapeHtml(data.disclaimer || "This is AI-generated information only. Always consult a qualified medical professional.")}</p>
    </div>`;
}

function renderFlaggedItems(flaggedItems) {
  if (!flaggedItems || !flaggedItems.length) {
    return `<div class="result-card animate-in" style="animation-delay:.15s">
      <div class="card-icon">🚩</div>
      <div class="card-label">Flagged Items</div>
      <p class="card-body muted">No flagged items. Everything appears within normal range.</p>
    </div>`;
  }

  const items = flaggedItems.map((fi) => {
    const sev = (fi.severity || "low").toLowerCase();
    const borderClass = sev === "high" ? "flagged-high" : sev === "medium" ? "flagged-medium" : "flagged-low";
    return `<div class="flagged-item ${borderClass}">
      <div class="flagged-item-header">
        <span class="flagged-item-name">${escapeHtml(fi.item || "Unknown")}</span>
        <span class="flagged-severity-tag sev-${sev}">${capitalise(sev)}</span>
      </div>
      <p class="flagged-reason">${escapeHtml(fi.reason || "")}</p>
    </div>`;
  }).join("");

  return `<div class="result-card animate-in" style="animation-delay:.15s">
    <div class="card-icon">🚩</div>
    <div class="card-label">Flagged Items</div>
    <div class="flagged-list">${items}</div>
  </div>`;
}

function renderRawResult(rawText) {
  els.resultsSection.style.display = "block";
  els.resultsContainer.innerHTML = `
    <div class="result-card animate-in">
      <div class="card-icon">📄</div>
      <div class="card-label">Analysis Result</div>
      <p class="card-body raw-result-text">${escapeHtml(rawText)}</p>
    </div>
    <div class="result-card disclaimer-card animate-in" style="animation-delay:.1s">
      <div class="disclaimer-icon">⚠️</div>
      <p class="disclaimer-text">This is AI-generated information only. Always consult a qualified medical professional.</p>
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

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast-show"));
  setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 3200);
}

// ─── Sidebar (Mobile) ──────────────────────────────────────────────────────────
function openSidebar() {
  els.sidebar.classList.add("open");
  els.mainOverlay.style.display = "block";
  requestAnimationFrame(() => els.mainOverlay.classList.add("visible"));
}

function closeSidebar() {
  els.sidebar.classList.remove("open");
  els.mainOverlay.classList.remove("visible");
  setTimeout(() => {
    if (!els.sidebar.classList.contains("open")) els.mainOverlay.style.display = "none";
  }, 300);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSeverityClass(severity) {
  switch ((severity || "").toLowerCase()) {
    case "low":      return "low";
    case "moderate": return "moderate";
    case "high":     return "high";
    case "urgent":   return "urgent";
    default:         return "low";
  }
}

function escapeHtml(str) {
  if (typeof str !== "string") return String(str || "");
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function capitalise(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function attachEventListeners() {
  // API Key
  els.saveApiKey.addEventListener("click", saveApiKey);
  els.apiKeyInput.addEventListener("keydown", (e) => { if (e.key === "Enter") saveApiKey(); });
  els.toggleApiKey.addEventListener("click", () => {
    const isPassword = els.apiKeyInput.type === "password";
    els.apiKeyInput.type = isPassword ? "text" : "password";
    els.toggleApiKey.textContent = isPassword ? "🙈" : "👁️";
    els.toggleApiKey.setAttribute("aria-label", isPassword ? "Hide API key" : "Show API key");
  });

  // Hero CTA smooth scroll
  const heroCta = document.getElementById("hero-cta-btn");
  if (heroCta) {
    heroCta.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("analyzer")?.scrollIntoView({ behavior: "smooth" });
    });
  }

  // Drop Zone
  els.dropZone.addEventListener("click", (e) => {
    const clickable = [els.dropZone, ...els.dropZone.querySelectorAll(".drop-zone-label,.drop-zone-icon,.drop-zone-hint,strong")];
    if (clickable.some(el => el === e.target) && (els.imagePreview.style.display === "none" || !els.imagePreview.style.display)) {
      els.fileInput.click();
    }
  });
  els.fileInput.addEventListener("change", (e) => { if (e.target.files.length) handleFile(e.target.files[0]); });
  els.dropZone.addEventListener("dragover", (e) => { e.preventDefault(); els.dropZone.classList.add("drag-over"); });
  els.dropZone.addEventListener("dragleave", () => els.dropZone.classList.remove("drag-over"));
  els.dropZone.addEventListener("drop", (e) => {
    e.preventDefault(); els.dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  });

  // Remove image
  els.removeImage.addEventListener("click", (e) => { e.stopPropagation(); removeImage(); });

  // Char count
  els.symptomsInput.addEventListener("input", () => {
    const len = els.symptomsInput.value.length;
    els.charCount.textContent = `${len} / 2000`;
    els.charCount.style.color = len > 1900 ? "var(--red)" : "";
  });

  // Analyze
  els.analyzeBtn.addEventListener("click", runAnalysis);

  // PDF Export
  els.exportPdfBtn.addEventListener("click", exportAsPDF);

  // Error close
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
        const file = item.getAsFile();
        if (file) { handleFile(file); showToast("Image pasted from clipboard!", "success"); }
        break;
      }
    }
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
