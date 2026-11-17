export interface SlideContent { title: string; bullets: string[]; notes: string }
export interface PresentationContent {
  version: 1; title: string; language: 'en' | 'bn' | 'bilingual'; slides: SlideContent[];
}
const text = (value: unknown, limit: number, empty = false): string => {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
      || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(value)) {
    throw new Error('CONTENT_VALIDATION_FAILED');
  }
  return value.trim();
};
export function validatePresentation(value: unknown, expectedCount?: number): PresentationContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('CONTENT_VALIDATION_FAILED');
  const document = value as Record<string, unknown>;
  if (document.version !== 1 || !['en','bn','bilingual'].includes(String(document.language))
      || !Array.isArray(document.slides) || document.slides.length < 1 || document.slides.length > 100
      || (expectedCount !== undefined && document.slides.length !== expectedCount)) throw new Error('CONTENT_VALIDATION_FAILED');
  const slides = document.slides.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('CONTENT_VALIDATION_FAILED');
    const slide = item as Record<string, unknown>;
    if (!Array.isArray(slide.bullets) || slide.bullets.length < 1 || slide.bullets.length > 6) throw new Error('CONTENT_VALIDATION_FAILED');
    return { title: text(slide.title, 120), bullets: slide.bullets.map((bullet) => text(bullet, 280)),
      notes: text(slide.notes ?? '', 2000, true) };
  });
  return { version: 1, title: text(document.title, 200), language: document.language as PresentationContent['language'], slides };
}

export function parsePresentationResponse(value: unknown, count: number): PresentationContent {
  if (typeof value !== 'string' || value.length > 250_000) throw new Error('AI_OUTPUT_INVALID');
  // Permit one JSON fence; never evaluate model output or search it for executable code.
  const json = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return validatePresentation(JSON.parse(json), count); }
  catch { throw new Error('AI_OUTPUT_INVALID'); }
}
