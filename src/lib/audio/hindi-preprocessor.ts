/**
 * HindiTTSPreprocessor
 * Preprocesses Hindi text for natural Text-to-Speech synthesis:
 * 1. Unicode NFC normalization & whitespace cleanup
 * 2. Number expansion (0-100, thousands, lakhs, crores) in Hindi words
 * 3. Currency symbol (₹ / Rs.) to Hindi words
 * 4. Punctuation standardization (Western periods to Devanagari Purna Viram '।')
 * 5. Sentence-safe chunking to prevent API payload limits and unnatural pauses
 */

export class HindiTTSPreprocessor {
  private static readonly ONES: Record<number, string> = {
    0: 'शून्य', 1: 'एक', 2: 'दो', 3: 'तीन', 4: 'चार', 5: 'पाँच',
    6: 'छह', 7: 'सात', 8: 'आठ', 9: 'नौ', 10: 'दस',
    11: 'ग्यारह', 12: 'बारह', 13: 'तेरह', 14: 'चौदह', 15: 'पंद्रह',
    16: 'सोलह', 17: 'सत्रह', 18: 'अठारह', 19: 'उन्नीस', 20: 'बीस',
    21: 'इक्कीस', 22: 'बाईस', 23: 'तेईस', 24: 'चौबीस', 25: 'पच्चीस',
    26: 'छब्बीस', 27: 'सत्ताईस', 28: 'अट्ठाईस', 29: 'उनतीस', 30: 'तीस',
    31: 'इकतीस', 32: 'बत्तीस', 33: 'तैंतीस', 34: 'चौंतीस', 35: 'पैंतीस',
    36: 'छत्तीस', 37: 'सैंतीस', 38: 'अड़तीस', 39: 'उनतालीस', 40: 'चालीस',
    41: 'इकतालीस', 42: 'बयालीस', 43: 'तैंतालीस', 44: 'चवालीस', 45: 'पैंतालीस',
    46: 'छियालीस', 47: 'सैंतालीस', 48: 'अड़तालीस', 49: 'उनचास', 50: 'पचास',
    51: 'इक्यावन', 52: 'बावन', 53: 'तिरपन', 54: 'चौवन', 55: 'पचपन',
    56: 'छप्पन', 57: 'सत्तावन', 58: 'अट्ठावन', 59: 'उनसठ', 60: 'साठ',
    61: 'इकसठ', 62: 'बासठ', 63: 'तिरसठ', 64: 'चौंसठ', 65: 'पैंसठ',
    66: 'छियासठ', 67: 'सरसठ', 68: 'अड़सठ', 69: 'उनहत्तर', 70: 'सत्तर',
    71: 'इकहत्तर', 72: 'बहत्तर', 73: 'तिहत्तर', 74: 'चौहत्तर', 75: 'पचहत्तर',
    76: 'छिहत्तर', 77: 'सतहत्तर', 78: 'अठहत्तर', 79: 'उन्नासी', 80: 'अस्सी',
    81: 'इक्यासी', 82: 'बयासी', 83: 'तिरासी', 84: 'चौरासी', 85: 'पचासी',
    86: 'छियासी', 87: 'सत्तासी', 88: 'अट्ठासी', 89: 'नवासी', 90: 'नब्बे',
    91: 'इक्यानवे', 92: 'बानवे', 93: 'तिरानवे', 94: 'चौरानवे', 95: 'पंचानवे',
    96: 'छियानवे', 97: 'सत्तानवे', 98: 'अट्ठानवे', 99: 'निन्यानवे', 100: 'सौ',
  };

  /**
   * Convert an integer (up to 999,99,99,999) into Hindi words using Indian numbering system
   */
  static numberToHindiWords(num: number): string {
    if (isNaN(num)) return '';
    if (num < 0) return 'ऋण ' + this.numberToHindiWords(Math.abs(num));
    if (num <= 100) return this.ONES[num] || num.toString();

    let parts: string[] = [];

    // Crores (1,00,00,000)
    if (num >= 10000000) {
      const cr = Math.floor(num / 10000000);
      parts.push(`${this.numberToHindiWords(cr)} करोड़`);
      num %= 10000000;
    }

    // Lakhs (1,00,000)
    if (num >= 100000) {
      const lk = Math.floor(num / 100000);
      parts.push(`${this.numberToHindiWords(lk)} लाख`);
      num %= 100000;
    }

    // Thousands (1,000)
    if (num >= 1000) {
      const th = Math.floor(num / 1000);
      parts.push(`${this.numberToHindiWords(th)} हज़ार`);
      num %= 1000;
    }

    // Hundreds (100)
    if (num >= 100) {
      const hd = Math.floor(num / 100);
      parts.push(`${this.ONES[hd]} सौ`);
      num %= 100;
    }

    // Remaining 0-99
    if (num > 0) {
      parts.push(this.ONES[num] || num.toString());
    }

    return parts.join(' ').trim();
  }

  /**
   * Expand currency amounts (e.g. ₹500 or Rs. 1000 or INR 50) into Hindi words
   */
  static expandCurrency(text: string): string {
    // Matches ₹ 500, Rs. 500, Rs 500, INR 500
    const currencyRegex = /(?:₹|Rs\.?|INR)\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi;

    return text.replace(currencyRegex, (_, digits) => {
      const cleanNum = parseInt(digits.replace(/,/g, ''), 10);
      if (isNaN(cleanNum)) return digits;
      const hindiWords = this.numberToHindiWords(cleanNum);
      return `${hindiWords} रुपये`;
    });
  }

  /**
   * Expand percentages (e.g. 50% or 100%)
   */
  static expandPercentages(text: string): string {
    return text.replace(/(\d+)\s*%/g, (_, digits) => {
      const cleanNum = parseInt(digits, 10);
      if (isNaN(cleanNum)) return digits;
      return `${this.numberToHindiWords(cleanNum)} प्रतिशत`;
    });
  }

  /**
   * Expand standalone Western/Latin numbers to Hindi words
   */
  static expandNumbers(text: string): string {
    return text.replace(/\b\d+\b/g, (match) => {
      const num = parseInt(match, 10);
      if (!isNaN(num) && num >= 0 && num <= 999999999) {
        return this.numberToHindiWords(num);
      }
      return match;
    });
  }

  /**
   * Standardize punctuation for Hindi speech:
   * - Replace Latin period '.' following Devanagari with purna viram '।'
   * - Replace multiple spaces with single space
   * - Standardize dashes
   */
  static normalizePunctuation(text: string): string {
    return text
      // Replace Latin dot following Devanagari characters or spaces with purna viram
      .replace(/([\u0900-\u097F])\s*\.\s*/g, '$1। ')
      // Normalize double quotes to single or natural pauses
      .replace(/[""]/g, '"')
      // Normalize dashes
      .replace(/[—–]/g, ' - ')
      // Clean duplicate purna viram
      .replace(/।+/g, '।')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Full preprocessing pipeline for TTS input
   */
  static preprocess(text: string): string {
    if (!text) return '';

    // 1. Unicode NFC normalization
    let processed = text.normalize('NFC');

    // 2. Expand Currency
    processed = this.expandCurrency(processed);

    // 3. Expand Percentages
    processed = this.expandPercentages(processed);

    // 4. Expand Standalone Numbers
    processed = this.expandNumbers(processed);

    // 5. Normalize Punctuation & Whitespace
    processed = this.normalizePunctuation(processed);

    return processed;
  }

  /**
   * Splits a long text into natural sentence chunks respecting Hindi punctuation (।, ?, !, \n)
   * Each chunk stays below maxChars (default 400 for Sarvam AI Bulbul)
   */
  static chunkText(text: string, maxChars: number = 400): string[] {
    const preprocessed = this.preprocess(text);
    if (!preprocessed) return [];

    // Split on primary delimiters: ।, ?, !, newline
    const sentenceDelimiters = /([।?!;\n]+)/g;
    const tokens = preprocessed.split(sentenceDelimiters);

    const sentences: string[] = [];
    let currentSentence = '';

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.match(sentenceDelimiters)) {
        currentSentence += token;
        if (currentSentence.trim()) {
          sentences.push(currentSentence.trim());
          currentSentence = '';
        }
      } else {
        currentSentence += token;
      }
    }
    if (currentSentence.trim()) {
      sentences.push(currentSentence.trim());
    }

    // Now group sentences into chunks <= maxChars
    const chunks: string[] = [];
    let currentChunk = '';

    for (const sentence of sentences) {
      if (!currentChunk) {
        // If single sentence exceeds maxChars, split by comma or words
        if (sentence.length > maxChars) {
          const subChunks = this.splitLongSentence(sentence, maxChars);
          chunks.push(...subChunks);
        } else {
          currentChunk = sentence;
        }
      } else if ((currentChunk + ' ' + sentence).length <= maxChars) {
        currentChunk += ' ' + sentence;
      } else {
        chunks.push(currentChunk);
        if (sentence.length > maxChars) {
          const subChunks = this.splitLongSentence(sentence, maxChars);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = sentence;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Fallback to split an abnormally long single sentence on commas or spaces
   */
  private static splitLongSentence(sentence: string, maxChars: number): string[] {
    const parts: string[] = [];
    const commaParts = sentence.split(/,\s*/);
    let buf = '';

    for (const cp of commaParts) {
      if (!buf) {
        buf = cp;
      } else if ((buf + ', ' + cp).length <= maxChars) {
        buf += ', ' + cp;
      } else {
        parts.push(buf);
        buf = cp;
      }
    }
    if (buf) parts.push(buf);

    return parts;
  }
}
