// src: server/http/routes/ai.ts
// ------------------------------------------------------------
// AI utilities – slide generation and simple summarization.
// Both endpoints are public (no Supabase auth) and store results on Puter.
// ------------------------------------------------------------
import { Router } from "express";
import PPTXGenJS from "pptxgenjs";
import { Puter } from "@heyputer/puter-js";
import { Buffer } from "node:buffer";

const router = Router();

/**
 * Generate a minimal PPTX slide from a text prompt.
 * Returns a Node Buffer containing the PPTX file.
 */
function generateSlide(prompt: string): Buffer {
  const pptx = new PPTXGenJS();
  const slide = pptx.addSlide();
  slide.addText(prompt, { x: 0.5, y: 1, w: 9, h: 5, fontSize: 24, color: "363636" });
  // Placeholder image – could be replaced with an AI‑generated one later.
  slide.addImage({ path: "https://picsum.photos/seed/ai/800/600", x: 1, y: 3, w: 6, h: 4 });
  // @ts-ignore – use internal arraybuffer save for Node.
  const arrayBuffer = pptx.save("arraybuffer");
  return Buffer.from(arrayBuffer);
}

/** Helper to obtain a Puter client – throws if token missing. */
function getPuter(): Puter {
  const token = process.env.PUTER_TOKEN;
  if (!token) throw new Error("PUTER_TOKEN not configured");
  return new Puter({ token });
}

// ---------------------------------------------------------------------
// POST /generate-slide
// Accepts { prompt: string } and returns a public URL to the generated PPTX.
// ---------------------------------------------------------------------
router.post("/generate-slide", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });
  try {
    const pptxBuffer = generateSlide(prompt);
    const puter = getPuter();
    const folder = await puter.fs.mkdir({ path: "/AI‑Slides", existOk: true });
    const filename = `slide-${Date.now()}.pptx`;
    await puter.fs.writeFile({ path: `${folder.path}/${filename}`, data: pptxBuffer, overwrite: true });
    const share = await puter.fs.share({ path: `${folder.path}/${filename}`, public: true });
    res.json({ url: share.url, filename });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: (e as Error).message });
  }
});

// ---------------------------------------------------------------------
// POST /summarize
// Accepts { text: string } and returns a 1‑sentence summary stored on Puter.
// ---------------------------------------------------------------------
router.post("/summarize", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });
  try {
    // Naïve summarization – first sentence or first 150 chars.
    const firstSentence = text.split(/[.!?]+/)[0];
    const summary = firstSentence.length > 150 ? firstSentence.slice(0, 150) + "…" : firstSentence;
    const buffer = Buffer.from(summary, "utf-8");
    const puter = getPuter();
    const folder = await puter.fs.mkdir({ path: "/AI‑Summaries", existOk: true });
    const filename = `summary-${Date.now()}.txt`;
    await puter.fs.writeFile({ path: `${folder.path}/${filename}`, data: buffer, overwrite: true });
    const share = await puter.fs.share({ path: `${folder.path}/${filename}`, public: true });
    res.json({ url: share.url, filename, summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: (e as Error).message });
  }
});

export const aiRouter = router;
