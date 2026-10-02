import fs from 'fs';
import path from 'path';

export interface PronunciationRule {
  word: string;
  replacement: string;
  isRegex?: boolean;
  notes?: string;
}

/**
 * PronunciationDictionary
 * Handles phonetic and orthographic replacements for proper nouns, Indian character names,
 * historical kingdoms, Sanskrit loanwords, and English transliterations that TTS engines
 * frequently mispronounce.
 */
export class PronunciationDictionary {
  // Built-in system dictionary for common Indian cinematic names and terminology
  private static readonly SYSTEM_DICTIONARY: Record<string, string> = {
    // English to Devanagari transliteration corrections
    'Maharaja': 'महाराजा',
    'Vikramaditya': 'विक्रमादित्य',
    'Ayodhya': 'अयोध्या',
    'Hastinapur': 'हस्तिनापुर',
    'Bharat': 'भारत',
    'Dharmashastra': 'धर्मशास्त्र',
    'Gurukul': 'गुरुकुल',
    'Senapati': 'सेनापति',
    'Rajkumari': 'राजकुमारी',
    'Pradhan Mantri': 'प्रधानमंत्री',
    'Dharma': 'धर्म',
    'Karma': 'कर्म',
    'Moksha': 'मोक्ष',
    'Yoddha': 'योद्धा',
    'Devi': 'देवी',
    'Devata': 'देवता',
    'Bhagwan': 'भगवान',
    'Kripa': 'कृपा',
    'Aashirwad': 'आशीर्वाद',
    // Common Devanagari phonetic corrections for natural audio flow
    'अथवा': 'या', // Natural spoken flow alternative where suitable
  };

  /**
   * Applies both system and custom project pronunciation rules to input text
   */
  static apply(
    text: string,
    customRules?: Record<string, string> | PronunciationRule[]
  ): string {
    if (!text) return '';

    let result = text;

    // 1. Apply system rules
    for (const [word, replacement] of Object.entries(this.SYSTEM_DICTIONARY)) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      result = result.replace(regex, replacement);
    }

    // 2. Apply custom project rules if provided
    if (customRules) {
      if (Array.isArray(customRules)) {
        for (const rule of customRules) {
          if (rule.isRegex) {
            try {
              const regex = new RegExp(rule.word, 'gi');
              result = result.replace(regex, rule.replacement);
            } catch {
              result = result.split(rule.word).join(rule.replacement);
            }
          } else {
            const regex = new RegExp(`\\b${rule.word}\\b`, 'gi');
            result = result.replace(regex, rule.replacement);
          }
        }
      } else {
        for (const [word, replacement] of Object.entries(customRules)) {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          result = result.replace(regex, replacement);
        }
      }
    }

    return result;
  }

  /**
   * Load project-specific pronunciation dictionary from project storage
   */
  static getProjectDictionaryPath(projectId: string): string {
    return path.join(process.cwd(), 'data', 'projects', projectId, 'pronunciation.json');
  }

  static loadProjectDictionary(projectId: string): Record<string, string> {
    const dictPath = this.getProjectDictionaryPath(projectId);
    if (!fs.existsSync(dictPath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(dictPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  static saveProjectDictionary(projectId: string, rules: Record<string, string>): void {
    const dictPath = this.getProjectDictionaryPath(projectId);
    const dir = path.dirname(dictPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dictPath, JSON.stringify(rules, null, 2), 'utf8');
  }
}
