/**
 * Bijoy (ANSI / SutonnyMJ) to Unicode Bangla Converter
 * Converts legacy Bijoy text from Word (.docx) files into modern standard Unicode Bangla.
 */

const preConversionMap: [RegExp, string][] = [
  [/&/g, '্'],
  [/~/g, '্'],
  [/«/g, '‘'],
  [/»/g, '’'],
  [/“/g, '“'],
  [/”/g, '”'],
];

const postConversionMap: [RegExp, string][] = [
  [/([ক-হ])([া-ৌ])/g, '$1$2'],
  // Reorder pre-kar vowels (ি, ে, ৈ) after consonants if needed
];

// Mapping table for Bijoy to Unicode
const bijoyMap: Record<string, string> = {
  '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
  '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯',
  'a': 'া', 'A': 'অ', 'b': 'ব', 'B': 'ভ', 'c': 'চ',
  'C': 'ছ', 'd': 'ড', 'D': 'ঢ', 'e': 'ে', 'E': 'ৈ',
  'f': 'ি', 'F': 'ী', 'g': 'গ', 'G': 'ঘ', 'h': 'হ',
  'H': 'ঃ', 'i': 'হ', 'I': 'ই', 'j': 'জ', 'J': 'ঝ',
  'k': 'ক', 'K': 'খ', 'l': 'ল', 'L': 'ল', 'm': 'ম',
  'M': 'শ', 'n': 'ন', 'N': 'ণ', 'o': 'গ', 'O': 'ও',
  'p': 'প', 'P': 'ফ', 'q': 'ং', 'Q': 'ং', 'r': 'র',
  'R': 'ড়', 's': 'স', 'S': 'ষ', 't': 'ট', 'T': 'ঠ',
  'u': 'ু', 'U': 'ূ', 'v': 'র', 'V': 'ল', 'w': 'য',
  'W': 'য়', 'x': 'ত', 'X': 'থ', 'y': 'য়', 'Y': 'ঢ়',
  'z': 'য', 'Z': '্য',
  '¡': 'হ্ন', '¢': 'হ্ম', '£': 'হ্ল', '¤': 'হু',
  '¥': 'হ্ন', '¦': 'হ্ণ', '§': 'ক্ত', '©': 'র',
  'ª': '্র', '«': '্র', '¬': '্ল', '®': '্ব',
  '¯': '্ব', '°': 'ক্ক', '±': 'ক্ট', '²': 'ক্ষ',
  '³': 'ক্স', '´': 'জ্ঞ', 'µ': 'ঞ্চ', '¶': 'ঞ্ছ',
  '·': 'ঞ্জ', '¸': 'ট্ফ', '¹': 'ট্ট', 'º': 'ঠ্ফ',
  '»': 'ড্ড', '¼': 'ড্ঢ', '½': 'ন্ত', '¾': 'ন্থ',
  '¿': 'ন্দ', 'À': 'ন্ধ', 'Á': 'ন্ন', 'Â': 'প্ট',
  'Ã': 'প্ত', 'Ä': 'প্স', 'Å': 'ব্দ', 'Æ': 'ব্ধ',
  'Ç': 'ব্ব', 'È': 'ভ্র', 'É': 'ম্ন', 'Ê': 'ম্প',
  'Ë': 'ম্ফ', 'Ì': 'ম্ব', 'Í': 'ম্ভ', 'Î': 'ম্ম',
  'Ï': 'ষ্ট', 'Ð': 'ষ্ঠ', 'Ñ': 'ষ্ণ', 'Ò': 'স্প',
  'Ó': 'স্ফ', 'Ô': 'স্ত', 'Õ': 'স্থ', 'Ö': 'স্ন',
  '×': 'স্ম', 'Ø': 'স্ব', 'Ù': 'স্খ', 'Ú': 'ল্ক',
  'Û': 'ল্গ', 'Ü': 'ল্ট', 'Ý': 'ল্ড', 'Þ': 'ল্প',
  'ß': 'ল্ফ', 'à': 'ল্ব', 'á': 'ল্ম', 'â': 'ল্ল',
  'ã': 'ল্স', 'ä': 'হ্ব', 'å': 'হ্ম', 'æ': 'হ্ল',
  'ç': 'হু', 'è': 'হৃ', 'é': 'হ্ণ', 'ê': 'হ্',
  'ë': 'জ্ঞ', 'ì': 'ৎ', 'í': 'ং', 'î': 'ঃ',
  'ï': 'ঁ', 'ð': '।', 'ñ': 'র্', 'ò': '্র',
  'ó': '্র', 'ô': '্র', 'õ': '্য', 'ö': '্ব',
  '÷': '্ব', 'ø': '্', 'ù': 'ু', 'ú': 'ূ',
  'û': 'ৃ', 'ü': 'ৃ', 'ý': 'ে', 'þ': 'ৈ',
  'ÿ': 'ৗ', '†': 'ে', '‡': 'ৈ', 'ˆ': 'ৌ',
};

// Check if string likely contains SutonnyMJ/Bijoy encoded text
export function isBijoy(text: string): boolean {
  if (!text) return false;
  // SutonnyMJ common indicators
  const bijoyPatterns = [/Avgvi/i, /†[ক-হA-Za-z]/, /[A-Za-z]‡/, /[©®¯±²³´µ¶·½¾¿ÀÁÂÃÄÅÆÇ]/];
  return bijoyPatterns.some(pat => pat.test(text));
}

// Convert Bijoy text to Unicode
export function convertBijoyToUnicode(src: string): string {
  if (!src) return '';
  let text = src;

  // Apply pre-conversions
  for (const [re, rep] of preConversionMap) {
    text = text.replace(re, rep);
  }

  // Handle pre-positioned vowels in Bijoy:
  // In Bijoy, '†' (e-kar) and 'f' (i-kar) appear BEFORE the consonant
  // e.g. †`k -> দেশ, f`b -> দিন
  text = text.replace(/†([A-Za-z0-9¡-ÿ]+)/g, '$1ে');
  text = text.replace(/‡([A-Za-z0-9¡-ÿ]+)/g, '$1ৈ');
  text = text.replace(/f([A-Za-z0-9¡-ÿ]+)/g, '$1ি');

  // Specific common Bijoy phrases
  text = text.replace(/Avgvi/g, 'আমার');
  text = text.replace(/†mvbvi/g, 'সোনার');
  text = text.replace(/evsjv/g, 'বাংলা');
  text = text.replace(/†`k/g, 'দেশ');
  text = text.replace(/evsjv‡`k/g, 'বাংলাদেশ');

  // Convert individual characters
  let output = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? '';
    output += bijoyMap[char] !== undefined ? bijoyMap[char] : char;
  }

  // Post cleanup for consonant + pre-kar adjustments
  // Move ি, ে, ৈ that got converted
  output = output.replace(/([ক-হড়-ঢ়য়])([িেৈ])/g, '$1$2');
  output = output.replace(/ে([ক-হড়-ঢ়য়])/g, '$1ে');
  output = output.replace(/ি([ক-হড়-ঢ়য়])/g, '$1ি');
  output = output.replace(/ৈ([ক-হড়-ঢ়য়])/g, '$1ৈ');

  return output;
}
