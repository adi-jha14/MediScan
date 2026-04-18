/**
 * app.js — MediScan AI
 * Core application logic, UI management, session history.
 */

// ─── State ──────────────────────────────────────────────────────────────────
const state = {
  apiKey: "",
  currentFile: null,
  currentBase64: null,
  currentMimeType: null,
  isLoading: false,
  sessions: [],       // Array of session objects from localStorage
  activeSessionId: null,
};

const LS_KEY_SESSIONS = "mediscan_sessions";
const MAX_SESSIONS    = 50;

// ─── DOM References ──────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  dropZone:           $("drop-zone"),
  fileInput:          $("file-input"),
  imagePreview:       $("image-preview"),
  previewImg:         $("preview-img"),
  previewName:        $("preview-name"),
  previewSize:        $("preview-size"),
  removeImage:        $("remove-image"),
  compressionNote:    $("compression-note"),

  symptomsInput:      $("symptoms-input"),
  charCount:          $("char-count"),

  analyzeBtn:         $("analyze-btn"),
  analyzeBtnText:     $("analyze-btn-text"),
  analyzeBtnSpinner:  $("analyze-btn-spinner"),

  loadingOverlay:     $("loading-overlay"),
  resultsSection:     $("results-section"),
  resultsContainer:   $("results-container"),

  historyList:        $("history-list"),
  clearHistoryBtn:    $("clear-history-btn"),
  sidebarToggle:      $("sidebar-toggle"),
  sidebar:            $("sidebar"),
  mainOverlay:        $("main-overlay"),

  toastContainer:     $("toast-container"),
  errorBanner:        $("error-banner"),
  errorMsg:           $("error-msg"),
  errorClose:         $("error-close"),
};

// ─── Init ────────────────────────────────────────────────────────────────────
function init() {
  // Use the hardcoded key defined in api.js
  state.apiKey = (typeof HARDCODED_API_KEY !== "undefined" && HARDCODED_API_KEY !== "YOUR_API_KEY_HERE")
    ? HARDCODED_API_KEY
    : "";
  loadSessions();
  renderHistory();
  attachEventListeners();
}

// ─── API Key ─────────────────────────────────────────────────────────────────
// Key is hardcoded in api.js as HARDCODED_API_KEY — no runtime input needed.

// ─── Session History ─────────────────────────────────────────────────────────
function loadSessions() {
  try {
    const raw = localStorage.getItem(LS_KEY_SESSIONS);
    state.sessions = raw ? JSON.parse(raw) : [];
  } catch (_) {
    state.sessions = [];
  }
}

function saveSessions() {
  // Keep only last MAX_SESSIONS
  if (state.sessions.length > MAX_SESSIONS) {
    state.sessions = state.sessions.slice(-MAX_SESSIONS);
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
      : rawText
      ? rawText.substring(0, 100) + "…"
      : "No summary available.",
    fullData: resultData || null,
    rawText: rawText || null,
  };

  state.sessions.unshift(session);
  state.activeSessionId = id;
  saveSessions();
  renderHistory();
  return id;
}

function renderHistory() {
  if (!state.sessions.length) {
    els.historyList.innerHTML =
      '<li class="history-empty">No scans yet. Analyze a document to get started.</li>';
    return;
  }

  els.historyList.innerHTML = state.sessions
    .map((s) => {
      const date = new Date(s.timestamp);
      const timeStr = date.toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      }) + " " + date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

      const isActive = s.id === state.activeSessionId;
      const severityClass = getSeverityClass(s.severity);

      return `
        <li class="history-item ${isActive ? "active" : ""}" data-id="${s.id}" role="button" tabindex="0" aria-label="View scan from ${timeStr}">
          <div class="history-header">
            <span class="history-doc-type">${escapeHtml(s.document_type)}</span>
            <span class="severity-badge severity-${severityClass} severity-sm">${escapeHtml(s.severity)}</span>
          </div>
          <div class="history-summary">${escapeHtml(s.summary)}</div>
          <div class="history-time">${timeStr}</div>
        </li>`;
    })
    .join("");

  // Attach click + keyboard events
  els.historyList.querySelectorAll(".history-item").forEach((item) => {
    item.addEventListener("click", () => loadSession(item.dataset.id));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") loadSession(item.dataset.id);
    });
  });
}

function loadSession(id) {
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return;

  state.activeSessionId = id;
  renderHistory();

  if (session.fullData) {
    renderStructuredResult(session.fullData);
  } else if (session.rawText) {
    renderRawResult(session.rawText);
  }

  // On mobile, close sidebar after selection
  if (window.innerWidth < 768) closeSidebar();

  // Scroll to results
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
    showError("Unsupported file type. Please upload a JPEG, PNG, WebP, GIF, or BMP image.");
    return;
  }

  state.currentFile = file;
  const sizeKB = (file.size / 1024).toFixed(1);
  const sizeMB = file.size / (1024 * 1024);

  els.previewName.textContent = file.name;
  els.previewSize.textContent = sizeMB >= 1 ? `${sizeMB.toFixed(2)} MB` : `${sizeKB} KB`;
  els.compressionNote.style.display = sizeMB > 4 ? "block" : "none";

  // Show thumbnail
  const url = URL.createObjectURL(file);
  els.previewImg.src = url;
  els.imagePreview.style.display = "flex";
  els.dropZone.classList.add("has-file");
}

function removeImage() {
  state.currentFile = null;
  state.currentBase64 = null;
  state.currentMimeType = null;
  els.previewImg.src = "";
  els.imagePreview.style.display = "none";
  els.dropZone.classList.remove("has-file");
  els.fileInput.value = "";
  els.compressionNote.style.display = "none";
}

// ─── Analysis ─────────────────────────────────────────────────────────────────
async function runAnalysis() {
  // Validation
  const text = els.symptomsInput.value.trim();
  if (!state.apiKey) {
    showError("API key is not configured. Open api.js and set HARDCODED_API_KEY.");
    return;
  }
  if (!state.currentFile && !text) {
    showError("Please upload a document or describe your symptoms.");
    return;
  }

  setLoading(true);
  clearError();

  try {
    let base64 = null;
    let mimeType = null;
    let wasCompressed = false;

    if (state.currentFile) {
      const result = await processImage(state.currentFile);
      base64 = result.base64;
      mimeType = result.mimeType;
      wasCompressed = result.wasCompressed;

      if (wasCompressed) {
        showToast("Image compressed to fit within 4 MB limit.", "info");
      }
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
      showError("Please enter your Gemini API key to continue.");
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

// ─── Result Rendering ─────────────────────────────────────────────────────────
function renderStructuredResult(data) {
  els.resultsSection.style.display = "block";
  const severityClass = getSeverityClass(data.severity_indicator);

  els.resultsContainer.innerHTML = `
    <!-- Header Card -->
    <div class="result-card result-header-card animate-in">
      <div class="result-header-top">
        <div>
          <div class="card-label">Document Type</div>
          <h2 class="doc-type-title">${escapeHtml(data.document_type || "Unknown")}</h2>
        </div>
        <div class="severity-badge severity-${severityClass} ${severityClass === "urgent" ? "severity-urgent-pulse" : ""}">
          <span class="severity-dot"></span>
          ${escapeHtml(data.severity_indicator || "—")}
        </div>
      </div>
    </div>

    <!-- Summary Card -->
    <div class="result-card animate-in" style="animation-delay: 0.05s">
      <div class="card-icon">📋</div>
      <div class="card-label">Summary</div>
      <p class="card-body">${escapeHtml(data.summary || "No summary provided.")}</p>
    </div>

    <!-- Key Findings Card -->
    <div class="result-card animate-in" style="animation-delay: 0.1s">
      <div class="card-icon">🔍</div>
      <div class="card-label">Key Findings</div>
      <ul class="findings-list">
        ${
          (data.key_findings || []).length
            ? data.key_findings
                .map((f) => `<li class="finding-item">${escapeHtml(f)}</li>`)
                .join("")
            : '<li class="finding-item muted">No key findings reported.</li>'
        }
      </ul>
    </div>

    <!-- Flagged Items Card -->
    ${renderFlaggedItems(data.flagged_items)}

    <!-- Doctor Questions Card -->
    <div class="result-card animate-in" style="animation-delay: 0.2s">
      <div class="card-icon">💬</div>
      <div class="card-label">Questions to Ask Your Doctor</div>
      <ol class="doctor-questions-list">
        ${
          (data.doctor_questions || []).length
            ? data.doctor_questions
                .map((q) => `<li class="doctor-question">${escapeHtml(q)}</li>`)
                .join("")
            : '<li class="doctor-question muted">No questions generated.</li>'
        }
      </ol>
    </div>

    <!-- Disclaimer Card -->
    <div class="result-card disclaimer-card animate-in" style="animation-delay: 0.25s">
      <div class="disclaimer-icon">⚠️</div>
      <p class="disclaimer-text">${escapeHtml(data.disclaimer || "This is AI-generated information only. Always consult a qualified medical professional.")}</p>
    </div>
  `;
}

function renderFlaggedItems(flaggedItems) {
  if (!flaggedItems || !flaggedItems.length) {
    return `
      <div class="result-card animate-in" style="animation-delay: 0.15s">
        <div class="card-icon">🚩</div>
        <div class="card-label">Flagged Items</div>
        <p class="card-body muted">No flagged items. Everything appears within normal range.</p>
      </div>`;
  }

  const items = flaggedItems
    .map((fi) => {
      const sev = (fi.severity || "low").toLowerCase();
      const borderClass = sev === "high" ? "flagged-high" : sev === "medium" ? "flagged-medium" : "flagged-low";
      return `
        <div class="flagged-item ${borderClass}">
          <div class="flagged-item-header">
            <span class="flagged-item-name">${escapeHtml(fi.item || "Unknown")}</span>
            <span class="flagged-severity-tag sev-${sev}">${capitalise(sev)}</span>
          </div>
          <p class="flagged-reason">${escapeHtml(fi.reason || "")}</p>
        </div>`;
    })
    .join("");

  return `
    <div class="result-card animate-in" style="animation-delay: 0.15s">
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
    <div class="result-card disclaimer-card animate-in" style="animation-delay: 0.1s">
      <div class="disclaimer-icon">⚠️</div>
      <p class="disclaimer-text">This is AI-generated information only. Always consult a qualified medical professional.</p>
    </div>
  `;
}

// ─── Error Handling ───────────────────────────────────────────────────────────
function showError(msg) {
  els.errorMsg.textContent = msg;
  els.errorBanner.style.display = "flex";
  els.errorBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearError() {
  els.errorBanner.style.display = "none";
  els.errorMsg.textContent = "";
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;
  els.toastContainer.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("toast-show");
  });

  setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.addEventListener("transitionend", () => toast.remove());
  }, 3200);
}

// ─── Sidebar (Mobile) ─────────────────────────────────────────────────────────
function openSidebar() {
  els.sidebar.classList.add("open");
  els.mainOverlay.style.display = "block";
  requestAnimationFrame(() => els.mainOverlay.classList.add("visible"));
}

function closeSidebar() {
  els.sidebar.classList.remove("open");
  els.mainOverlay.classList.remove("visible");
  setTimeout(() => {
    if (!els.sidebar.classList.contains("open")) {
      els.mainOverlay.style.display = "none";
    }
  }, 300);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getSeverityClass(severity) {
  if (!severity) return "low";
  switch (severity.toLowerCase()) {
    case "low":    return "low";
    case "moderate": return "moderate";
    case "high":   return "high";
    case "urgent": return "urgent";
    default:       return "low";
  }
}

function escapeHtml(str) {
  if (typeof str !== "string") return String(str || "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function capitalise(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function attachEventListeners() {
  // File upload via button click
  els.dropZone.addEventListener("click", (e) => {
    if (e.target === els.dropZone || e.target.classList.contains("drop-zone-label") || e.target.classList.contains("drop-zone-icon")) {
      if (!els.imagePreview.style.display || els.imagePreview.style.display === "none") {
        els.fileInput.click();
      }
    }
  });

  els.fileInput.addEventListener("change", (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  // Drag and drop
  els.dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    els.dropZone.classList.add("drag-over");
  });

  els.dropZone.addEventListener("dragleave", () => {
    els.dropZone.classList.remove("drag-over");
  });

  els.dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    els.dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // Remove image
  els.removeImage.addEventListener("click", (e) => {
    e.stopPropagation();
    removeImage();
  });

  // Symptoms textarea character count
  els.symptomsInput.addEventListener("input", () => {
    const len = els.symptomsInput.value.length;
    els.charCount.textContent = `${len} / 2000`;
    if (len > 1900) els.charCount.style.color = "var(--red)";
    else els.charCount.style.color = "";
  });

  // Analyze button
  els.analyzeBtn.addEventListener("click", runAnalysis);

  // Error close
  els.errorClose.addEventListener("click", clearError);

  // History
  els.clearHistoryBtn.addEventListener("click", clearHistory);

  // Sidebar toggle (mobile)
  els.sidebarToggle.addEventListener("click", openSidebar);
  els.mainOverlay.addEventListener("click", closeSidebar);

  // Keyboard: Escape closes sidebar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSidebar();
  });

  // Paste image support
  document.addEventListener("paste", (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          handleFile(file);
          showToast("Image pasted from clipboard!", "success");
        }
        break;
      }
    }
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
