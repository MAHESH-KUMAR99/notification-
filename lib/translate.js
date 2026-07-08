// Covers Devanagari through Malayalam (U+0900–U+0D7F) — every Indic script
// these government sites publish in (Kannada, Gujarati, Tamil, etc).
const INDIC_SCRIPT_RE = /[ऀ-ൿ]/;

export function hasIndicScript(text) {
  return INDIC_SCRIPT_RE.test(text ?? "");
}

const LANGUAGE_NAMES = {
  hi: "Hindi",
  kn: "Kannada",
  gu: "Gujarati",
  ta: "Tamil",
  te: "Telugu",
  ml: "Malayalam",
  bn: "Bengali",
  pa: "Punjabi",
  or: "Odia",
  mr: "Marathi",
  as: "Assamese",
};

export function languageName(code) {
  return LANGUAGE_NAMES[code] ?? code?.toUpperCase() ?? "Original";
}

// Google's unqualified web-widget endpoint — no API key, but unofficial and
// rate-limited, so callers must tolerate failures (see translateTitle).
async function translateText(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Translate HTTP ${res.status}`);
  const data = await res.json();
  const translated = data[0].map((chunk) => chunk[0]).join("");
  const detectedLang = data[2];
  return { translated, detectedLang };
}

/**
 * Best-effort English translation of a notice title. Returns null (not a
 * throw) on any failure — a broken translation must never block a notice
 * from being saved, since the original-language title is always shown as
 * the fallback.
 */
export async function translateTitle(title) {
  if (!hasIndicScript(title)) return null;
  try {
    const { translated, detectedLang } = await translateText(title);
    if (!translated || translated === title) return null;
    return { titleEn: translated, titleLang: detectedLang };
  } catch {
    return null;
  }
}
