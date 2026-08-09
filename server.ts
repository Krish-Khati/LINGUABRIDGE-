import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
app.use(express.json({ limit: "50mb" }));

const PORT = Number(process.env.PORT || 3000);

// Lazy initialize Gemini client to prevent crash on startup if key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

const SYSTEM_INSTRUCTION = `You are "LinguaBridge" — a multilingual assistant that supports two modes: Text Translation and Voice Conversation. Detect which mode is active from the input type (text input = Translation Mode, audio input = Voice Mode) and follow the matching rules below.

=== GENERAL RULES (apply to both modes) ===
1. Automatically detect the input language. Never ask the user which language they used.
2. Preserve the original tone (formal/casual/slang) — do not over-formalize.
3. Handle mixed-language input (e.g. Hinglish) by understanding full intent, not word-by-word.
4. Never leave a response empty or blank under any condition — always return a valid, clear response.
5. Do not add greetings, filler phrases like "Sure! Here's your answer:", or unnecessary commentary.

=== MODE 1: TEXT TRANSLATION ===
6. If the user specifies a target language, translate only into that language.
7. If no target language is given, default to English and show the detected source language.
8. Do not translate proper nouns, brand names, or numbers unless asked.
9. If input text is unclear, corrupted, or empty, respond with EXACTLY:
   "⚠️ Sorry, I couldn't understand this text clearly. Please re-check and try again."
10. Output format must always be:
    Detected Language: [language]
    Translation ([target language]): [translated text]

=== MODE 2: VOICE INTERPRETER ===
11. Act as a real-time bilingual interpreter between two people speaking different languages.
12. Automatically detect the spoken language from the audio input.
13. Based on the conversation history and the audio, deduce the two primary languages being spoken.
14. Translate the spoken audio into the OTHER language. If only one language has been established so far, translate it to English (unless the spoken language is already English, in which case ask what language they want to translate to).
15. Output ONLY the translated text. Do not add conversational filler, greetings, or explanations. Just output the translation.
16. If the speech is unclear or silent, respond with:
    "Sorry, I didn't catch that clearly, could you please repeat?"

=== ERROR HANDLING (both modes) ===
17. If any internal error occurs and a proper response cannot be generated, return:
    "Something went wrong. Please try again."
18. Never return broken formatting, half-finished sentences, or raw error codes to the user.`;

app.post("/api/interact", async (req, res) => {
  try {
    const { mode, text, audio, targetLanguage, history } = req.body;
    const ai = getGeminiClient();

    if (mode === "text") {
      let prompt = `[MODE 1: TEXT TRANSLATION]\n`;
      if (targetLanguage && targetLanguage.trim()) {
        prompt += `Target language: ${targetLanguage}\n`;
      }
      prompt += `Input:\n${text || ""}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1,
        },
      });

      let replyText = response.text || "Something went wrong. Please try again.";
      return res.json({ text: replyText });
      
    } else if (mode === "voice") {
      const parts: any[] = [];
      if (audio && audio.data) {
        parts.push({
          inlineData: { data: audio.data, mimeType: audio.mimeType },
        });
      } else {
        // if no audio sent but voice mode requested
        parts.push({ text: "(silence)" });
      }
      parts.push({ text: `\n[MODE 2: VOICE INTERPRETER]\nListen to the audio, automatically detect the language, and translate it to the other language used in this conversation. Output ONLY the translation.` });

      const contents: any[] = [];
      if (history && history.length > 0) {
        for (const msg of history) {
          contents.push({ role: msg.role, parts: [{ text: msg.text }] });
        }
      }
      contents.push({ role: "user", parts });

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0.1, // Low temperature for translation accuracy
        },
      });

      let replyText = response.text || "Something went wrong. Please try again.";

      // Generate TTS for the response
      let replyAudioBase64 = null;
      try {
        const ttsInteraction = await ai.interactions.create({
          model: "gemini-3.1-flash-tts-preview",
          input: replyText,
          response_modalities: ["audio"],
          generation_config: {
            speech_config: [
              {
                language: "en-us",
                voice: "zephyr"
              }
            ]
          },
        });

        for (const step of ttsInteraction.steps) {
          if (step.type === "model_output") {
            const audioContent = step.content?.find((c) => c.type === "audio");
            if (audioContent && audioContent.data) {
              replyAudioBase64 = audioContent.data;
            }
          }
        }
      } catch (ttsErr) {
        console.error("TTS generation failed:", ttsErr);
      }

      return res.json({ text: replyText, audio: replyAudioBase64 });
    } else {
      return res.status(400).json({ error: "Invalid mode" });
    }
  } catch (error: any) {
    console.error("Interaction API error:", error);
    return res.json({
      text: "Something went wrong. Please try again.",
    });
  }
});

app.post("/api/detect", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.json({ language: null });
    }
    const ai = getGeminiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `Detect the language of the following text. Respond with ONLY the language name in English (e.g. "Spanish", "French", "Hinglish"). If it's too short or unclear, respond with "Unknown".\n\nText:\n"${text}"`,
      config: {
        temperature: 0.1,
      }
    });
    const detected = response.text?.trim() || "Unknown";
    return res.json({ language: detected });
  } catch (error) {
    console.error("Detect API error:", error);
    return res.json({ language: "Unknown" });
  }
});

// Serve frontend assets and start listening
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Setup Vite development middleware
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production build files
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
