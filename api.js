/**
 * api.js — MediScan AI
 * Handles all communication with the Gemini API.
 */

const GEMINI_MODELS = [
  "gemini-2.5-flash",
];

const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/";

// ── Hardcoded API Key ──────────────────────────────────────────────────────
// Replace the value below with your Gemini API key.
const HARDCODED_API_KEY = "YOUR_API_KEY_HERE";

const SYSTEM_PROMPT = `You are MediScan AI, a medical document analysis assistant. Analyze the provided medical image and/or symptom description. Respond ONLY in this exact JSON format with no markdown, no code blocks, no extra text:
{
  "document_type": "string",
  "summary": "string",
  "key_findings": ["string", "string"],
  "flagged_items": [{"item": "string", "reason": "string", "severity": "high|medium|low"}],
  "severity_indicator": "Low|Moderate|High|Urgent",
  "doctor_questions": ["string", "string", "string"],
  "disclaimer": "This is AI-generated information only. Always consult a qualified medical professional."
}
Do not include any text outside this JSON object.`;

/**
 * Analyzes medical content using the Gemini API.
 * Tries each model in GEMINI_MODELS in order; moves to the next on quota errors.
 * @param {string} apiKey
 * @param {string|null} base64Image
 * @param {string|null} mimeType
 * @param {string} textInput
 * @returns {Promise<Object>}
 */
async function analyzeWithGemini(apiKey, base64Image, mimeType, textInput) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("MISSING_API_KEY");
  }

  const userParts = [];

  if (base64Image) {
    userParts.push({
      inline_data: {
        mime_type: mimeType || "image/jpeg",
        data: base64Image,
      },
    });
  }

  const textContent =
    textInput && textInput.trim()
      ? textInput.trim()
      : "Please analyze the provided medical document.";

  userParts.push({ text: textContent });

  const requestBody = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: userParts,
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topK: 32,
      topP: 0.9,
      maxOutputTokens: 8192,
      response_mime_type: "application/json",
    },
  };

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    const endpoint = `${GEMINI_BASE}${model}:generateContent?key=${apiKey.trim()}`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      // On quota / rate-limit errors try the next model
      if (response.status === 429 || response.status === 403) {
        let reason = `Model ${model} quota exceeded.`;
        try {
          const errBody = await response.json();
          if (errBody?.error?.message) reason = errBody.error.message;
        } catch (_) { }
        lastError = new Error(reason);
        // Brief pause before trying the next model
        await new Promise((r) => setTimeout(r, 1200));
        continue;
      }

      if (!response.ok) {
        let errMsg = `API Error ${response.status}: ${response.statusText}`;
        try {
          const errBody = await response.json();
          if (errBody?.error?.message) errMsg = `API Error: ${errBody.error.message}`;
        } catch (_) { }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error("Gemini returned an empty response. Please try again.");
      }

      // Strip potential markdown code fences and extract JSON block
      let jsonString = rawText;
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        jsonString = match[0];
      }

      try {
        return { success: true, data: JSON.parse(jsonString), model };
      } catch (_) {
        return { success: false, rawText, model };
      }

    } catch (err) {
      // Network-level error — don't try other models, just throw
      if (!(err.message.includes("quota") || err.message.includes("429"))) {
        throw err;
      }
      lastError = err;
    }
  }

  // All models exhausted
  throw new Error(
    `All available models have hit their quota limits. ` +
    `Please enable billing at https://ai.dev or wait for the quota to reset. ` +
    `Last error: ${lastError?.message || "Unknown"}`
  );
}

/**
 * Compresses an image File to ensure it stays under a byte limit.
 * @param {File} file - The original image file.
 * @param {number} maxBytes - Max allowed size in bytes (default 4MB).
 * @returns {Promise<{base64: string, mimeType: string, wasCompressed: boolean}>}
 */
async function processImage(file, maxBytes = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const originalBase64 = e.target.result.split(",")[1];
      const mimeType = file.type || "image/jpeg";

      if (file.size <= maxBytes) {
        resolve({ base64: originalBase64, mimeType, wasCompressed: false });
        return;
      }

      // Compress via canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down proportionally
        const scale = Math.sqrt(maxBytes / file.size) * 0.9;
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.82);
        const compressedBase64 = compressedDataUrl.split(",")[1];

        resolve({
          base64: compressedBase64,
          mimeType: "image/jpeg",
          wasCompressed: true,
        });
      };

      img.onerror = () => reject(new Error("Failed to load image for compression."));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}
