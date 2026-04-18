# MediScan AI 🩺

MediScan AI is a completely client-side vanilla JavaScript web application that analyzes medical documents, prescriptions, and symptoms using the Google Gemini 2.5 Flash multimodal API. 

It features a premium, responsive UI and allows users to upload medical documents or write symptoms to generate structured, doctor-ready clinical briefings instantly.

## ✨ Features

- **Zero-Dependency Architecture:** Built entirely with plain HTML, CSS, and Vanilla JavaScript. No bundlers, no frameworks, no npm packages.
- **Multimodal AI Analysis:** Supports sending images (lab reports, prescriptions) alongside text descriptions to Gemini 2.5 Flash.
- **Client-Side Image Compression:** Automatically compresses images over 4MB via HTML Canvas before sending to the API.
- **Robust JSON Extraction:** Strictly prompts the AI for structured data and surgically extracts JSON from the response to hydrate UI cards.
- **Local Session History:** Automatically saves past scans mapped with timestamps and severity badges to your browser's `localStorage`.
- **Dynamic Severity Badges:** Classifies medical urgency into Low (🟢), Moderate (🟡), High (🔴), and Urgent (🔴💓 with pulsing animation).
- **Responsive & Premium UI:** Designed with modern web standards, featuring drag-and-drop zones, glassmorphism interactions, and a clean clinical navy blue color palette.

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/MediScan.git
   ```
2. Open `api.js` and locate line 14:
   ```javascript
   const HARDCODED_API_KEY = "YOUR_API_KEY_HERE";
   ```
3. Replace `"YOUR_API_KEY_HERE"` with your actual Google Gemini API Key. (You can generate one for free at [Google AI Studio](https://aistudio.google.com/)).
4. Simply double-click `index.html` to open the app directly in your browser. No server required!

## 🛠️ Built With

- **HTML5:** Semantic structure
- **CSS3:** Native CSS variables, Flexbox, Grid, Animations (No Tailwind/Bootstrap)
- **Vanilla JavaScript (ES6+):** Fetch API, DOM Manipulation, File Reader, local storage
- **Google Gemini API:** `gemini-2.5-flash` model via the `v1beta` endpoint to allow System Instructions.

## ⚠️ Disclaimer

**This software is for educational and demonstrational purposes ONLY.** 
MediScan AI utilizes a generic Large Language Model (Gemini). It can hallucinate or misinterpret critical medical dosages and text. It should **never** be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified medical professional.

## 📝 Future Improvements
- Implement a lightweight Node.js/Python backend to securely hide the API key.
- Add user authentication and cloud database synchronization (Firebase/Supabase) to retain history across devices.
- Support chunked file streaming for extremely large high-resolution medical DICOM images.
