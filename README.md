# MediScan AI 🩺

> **Live Demo → [adi-jha14.github.io/MediScan](https://adi-jha14.github.io/MediScan/)**

An AI-powered medical document analyzer built entirely with **vanilla HTML, CSS, and JavaScript** — no frameworks, no build tools, no dependencies. Upload a lab report, prescription, or medicine strip, or simply describe your symptoms, and receive a fully structured clinical briefing in seconds, powered by **Google Gemini 2.5 Flash**.

---

## ✨ Features

### 🤖 AI Analysis
- Sends both **image + text simultaneously** to the Gemini multimodal API
- Enforces strict **structured JSON output** via system prompting — no hallucinated prose
- Returns 7 structured sections: Document Type, Summary, Key Findings, Flagged Items, Severity Indicator, Doctor Questions, and Disclaimer
- **Graceful fallback** — if Gemini returns unstructured text, it's still displayed cleanly

### 📁 Smart Image Handling
- **Drag & drop**, click-to-browse, or **Ctrl+V clipboard paste** for uploads
- Accepts JPEG, PNG, WebP, GIF, and BMP
- **Automatic client-side compression** via HTML Canvas — images over 4 MB are silently compressed before sending to prevent API payload limits

### 🎨 Premium UI
- Branded **page loader** with animated stethoscope on app start
- **Hero landing section** with gradient background, glassmorphism step cards, and a smooth scroll CTA
- Dark navy sidebar with session history, API key input, and a live Gemini status badge
- **Severity badges** with distinct colors: Low 🟢 / Moderate 🟡 / High 🔴 / Urgent 🔴💓 (with CSS pulse animation)
- Flagged items rendered with red/amber left-border accent cards
- Fully responsive — works on mobile with collapsible sidebar

### 🗂️ Session History
- Every scan auto-saved to **localStorage** (last 50 sessions)
- Sidebar shows timestamp, document type, and severity for each past scan
- Click any session to **instantly reload** results without re-calling the API
- Clear History button to wipe all data locally

### 📄 PDF Export
- One-click **"Export PDF"** button in the results header
- Custom `@media print` stylesheet hides all UI chrome — only the result cards are printed
- Works natively in all browsers via `window.print()`

### 🔒 Privacy First
- **Zero backend** — all processing happens in the browser
- API calls go directly from your browser to Google's Gemini endpoint — no intermediary server
- API key stored only in your browser's `localStorage`

---

## 🚀 Getting Started

### Option 1 — Use the Live App
Visit **[adi-jha14.github.io/MediScan](https://adi-jha14.github.io/MediScan/)** directly in your browser.

You will need a free **Google Gemini API key**:
1. Go to [aistudio.google.com](https://aistudio.google.com/)
2. Click **Get API key → Create API key**
3. Paste it into the sidebar input and click **Save**

### Option 2 — Run Locally
```bash
git clone https://github.com/adi-jha14/MediScan.git
cd MediScan
# Open index.html directly in your browser — no server required
```

> **Note:** If you want to hardcode your API key for personal local use, open `api.js` and set `HARDCODED_API_KEY` on line 15. **Never commit a real key to Git.**

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Structure | HTML5 (semantic, accessible) |
| Styling | Vanilla CSS3 — CSS variables, Flexbox, Grid, animations |
| Logic | Vanilla JavaScript ES6+ — Fetch API, FileReader, Canvas API, localStorage |
| AI Model | Google Gemini 2.5 Flash via `v1beta` REST API |
| Hosting | GitHub Pages |

> **Zero dependencies.** No React, no Tailwind, no npm, no bundler.

---

## 📊 Output Structure

Every analysis returns these 7 sections:

| # | Section | Description |
|---|---|---|
| 1 | **Document Type** | What type of medical content was detected |
| 2 | **Summary** | Plain-English explanation of the document |
| 3 | **Key Findings** | Important values, medicines, or observations |
| 4 | **Flagged Items** | Abnormal or risky items, highlighted in red/amber |
| 5 | **Severity Indicator** | `Low` / `Moderate` / `High` / `Urgent` |
| 6 | **Doctor Questions** | 3–5 specific follow-up questions to ask your physician |
| 7 | **Disclaimer** | Always shown — AI is not a substitute for medical advice |

---

## ⚠️ Disclaimer

**MediScan AI is for educational and demonstrational purposes only.**

It uses a general-purpose Large Language Model (Google Gemini) that can hallucinate, misread dosages, or generate incorrect medical information. It should **never** be used as a substitute for advice from a qualified medical professional. Always consult a licensed doctor for any health-related decisions.

---

## 🔮 Possible Future Improvements

- Lightweight **Node.js/Express** backend to securely store the API key server-side
- **User authentication** with cloud sync (Firebase / Supabase) for cross-device history
- **DICOM image support** for clinical radiology scans
- **Multi-language output** — analysis in the user's native language
- **Voice input** for symptom descriptions via the Web Speech API

---

## 👤 Author

**Aditya Jha** — [github.com/adi-jha14](https://github.com/adi-jha14)

---

*Powered by [Google Gemini](https://ai.google.dev/) · Deployed on [GitHub Pages](https://pages.github.com/)*
