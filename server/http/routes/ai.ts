// src: server/http/routes/ai.ts
// ------------------------------------------------------------
// AI utilities – slide generation and simple summarization.
// Both endpoints are public (no Supabase auth) and store results on Puter.
// ------------------------------------------------------------
import { Router } from "express";
import { Buffer } from "node:buffer";

const router = Router();

interface PuterServerClient {
  fs: {
    mkdir(opts: { path: string; existOk?: boolean }): Promise<{ path: string }>;
    writeFile(opts: { path: string; data: Buffer; overwrite?: boolean }): Promise<unknown>;
    share(opts: { path: string; public?: boolean }): Promise<{ url: string }>;
  };
}

/**
 * Generate a minimal PPTX slide from a text prompt when pptxgenjs is available.
 * Returns a Node Buffer containing the PPTX file.
 */
async function generateSlide(prompt: string): Promise<Buffer> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  const slide = pptx.addSlide();
  slide.addText(prompt, { x: 0.5, y: 1, w: 9, h: 5, fontSize: 24, color: "363636" });
  slide.addImage({ path: "https://picsum.photos/seed/ai/800/600", x: 1, y: 3, w: 6, h: 4 });
  const arrayBuffer = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return Buffer.from(arrayBuffer);
}

/** Helper to obtain a Puter client – throws if token missing. */
async function getPuter(): Promise<PuterServerClient> {
  const token = process.env.PUTER_TOKEN;
  if (!token) throw new Error("PUTER_TOKEN not configured");
  const mod = await import("@heyputer/puter.js");
  const puterClient = (mod.puter ?? mod.default) as unknown as PuterServerClient & { setAuthToken?: (t: string) => void };
  puterClient.setAuthToken?.(token);
  return puterClient;
}

// ---------------------------------------------------------------------
// POST /generate-slide
// Accepts { prompt: string } and returns a public URL to the generated PPTX.
// ---------------------------------------------------------------------
router.post("/generate-slide", async (req, res) => {
  const { prompt } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "Missing prompt" });
  if (!process.env.PUTER_TOKEN) {
    return res.status(503).json({ error: "PUTER_TOKEN not configured" });
  }
  try {
    const pptxBuffer = await generateSlide(prompt);
    const puter = await getPuter();
    const folder = await puter.fs.mkdir({ path: "/AI-Slides", existOk: true });
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
// Accepts { text: string } and returns a 1-sentence summary.
// ---------------------------------------------------------------------
router.post("/summarize", async (req, res) => {
  const { text } = req.body ?? {};
  if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing text" });
  try {
    const firstSentence = text.split(/[.!?]+/)[0] ?? text;
    const summary = firstSentence.length > 150 ? firstSentence.slice(0, 150) + "…" : firstSentence;
    if (!process.env.PUTER_TOKEN) {
      return res.json({ summary, stored: false });
    }
    const buffer = Buffer.from(summary, "utf-8");
    const puter = await getPuter();
    const folder = await puter.fs.mkdir({ path: "/AI-Summaries", existOk: true });
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
