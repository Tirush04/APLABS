/**
 * Number Guard for AI Safety
 * Strictly audits generated AI text against numbers present in the context JSON.
 * Replaces unverified numbers with "[not in data]".
 */

export interface ContextNumberEntry {
  keyPath: string;
  value: number;
  isPercent: boolean;
}

export interface VerifiedTokenInfo {
  token: string;
  matchedKey: string;
  metricCategory: 'pricing' | 'revenue' | 'amenity' | 'compliance' | 'outlook' | 'general';
}

export interface NumberGuardResult {
  sanitizedText: string;
  flaggedTokens: string[];
  verifiedTokens: VerifiedTokenInfo[];
  verified: boolean;
  primaryMetricCategory?: 'pricing' | 'revenue' | 'amenity' | 'compliance' | 'outlook' | 'general';
}

/**
 * Recursively extracts numbers only with their key paths from context JSON.
 * Strings are completely ignored (not parsed as numbers).
 */
export function extractNumbersFromContext(context: any, prefix = ''): ContextNumberEntry[] {
  const entries: ContextNumberEntry[] = [];
  if (context === null || context === undefined) return entries;

  if (Array.isArray(context)) {
    context.forEach((item, idx) => {
      entries.push(...extractNumbersFromContext(item, prefix ? `${prefix}[${idx}]` : `[${idx}]`));
    });
  } else if (typeof context === 'object') {
    for (const [key, val] of Object.entries(context)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof val === 'number' && !isNaN(val)) {
        const isPercent = /(_pct|_share|_percent)$/i.test(key);
        entries.push({ keyPath: path, value: val, isPercent });
      } else if (val && typeof val === 'object') {
        entries.push(...extractNumbersFromContext(val, path));
      }
      // Note: strings are deliberately ignored per specification
    }
  }

  return entries;
}

export function categorizeMetricKey(
  keyPath: string
): 'pricing' | 'revenue' | 'amenity' | 'compliance' | 'outlook' | 'general' {
  const lower = keyPath.toLowerCase();
  if (lower.includes('price') || lower.includes('pricing') || lower.includes('tier') || lower.includes('comparable_count')) {
    return 'pricing';
  }
  if (lower.includes('revenue') || lower.includes('occupancy') || lower.includes('carrying_cost') || lower.includes('booked_nights')) {
    return 'revenue';
  }
  if (lower.includes('amenity') || lower.includes('washer') || lower.includes('parking') || lower.includes('pool') || lower.includes('gym')) {
    return 'amenity';
  }
  if (lower.includes('compliance') || lower.includes('license') || lower.includes('superhost') || lower.includes('listings_total')) {
    return 'compliance';
  }
  if (lower.includes('outlook') || lower.includes('calendar') || lower.includes('pace')) {
    return 'outlook';
  }
  return 'general';
}

/**
 * Checks if a candidate number matches a context entry:
 * - Exact match, OR
 * - Equal after rounding to the precision written in the text.
 * - Handles k/K (×1,000), M (×1,000,000), and x multipliers.
 * - Allows ×100 percent conversion ONLY for keys ending in _pct, _share, or _percent.
 * - No generic ±1% tolerance, no ±0.5 against arbitrary values.
 */
export function matchesContextEntry(
  candidateNum: number,
  rawToken: string,
  entry: ContextNumberEntry,
  isPercentToken: boolean
): boolean {
  let target = entry.value;

  if (isPercentToken) {
    if (!entry.isPercent) return false;
    // Context percent value might be decimal (0.577) or already 0–100 (57.7)
    target = target <= 1 ? target * 100 : target;
  } else {
    // If not a percent token, don't match decimal percent keys (e.g. 0.577) against integer 58
    if (entry.isPercent && target <= 1) {
      return false;
    }
  }

  // Exact match
  if (Math.abs(candidateNum - target) < 0.0001) return true;

  // Check k / M suffixes (e.g., "$29.8k" matches 29760)
  const kmMatch = rawToken.match(/([\d,]+(?:\.\d+)?)\s*([kKmM])/);
  if (kmMatch) {
    const mult = kmMatch[2].toLowerCase() === 'm' ? 1000000 : 1000;
    const baseStr = kmMatch[1].replace(/,/g, '');
    const decParts = baseStr.split('.');
    const decPlaces = decParts.length > 1 ? decParts[1].length : 0;
    const factor = Math.pow(10, decPlaces);
    const roundedTarget = Math.round((target / mult) * factor) / factor;
    const writtenBase = parseFloat(baseStr);
    if (Math.abs(writtenBase - roundedTarget) < 0.0001) return true;
  }

  // Check standard decimal precision written in the text
  const cleanStr = rawToken.replace(/[\$,%xXkKmM\s]/g, '');
  if (cleanStr) {
    const parts = cleanStr.split('.');
    const decimals = parts.length > 1 ? parts[1].length : 0;
    const factor = Math.pow(10, decimals);
    const roundedTarget = Math.round(target * factor) / factor;
    if (Math.abs(candidateNum - roundedTarget) < 0.0001) return true;
  }

  return false;
}

/**
 * Spelled-out numbers to flag as unverified
 */
const SPELLED_OUT_REGEX =
  /\b(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-]+(?:one|two|three|four|five|six|seven|eight|nine))?\s+(?:hundred|thousand|million|billion)|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-]+(?:one|two|three|four|five|six|seven|eight|nine))?|hundred|thousand|million|billion)\b(?!\s*-(?:bed|bedroom|bath|bathroom|page|click|step))/gi;

/**
 * Enforces the Number Guard on generated AI text
 */
export function enforceNumberGuard(text: string, contextJson: any): NumberGuardResult {
  if (!text) {
    return {
      sanitizedText: '',
      flaggedTokens: [],
      verifiedTokens: [],
      verified: true,
    };
  }

  const contextEntries = extractNumbersFromContext(contextJson);
  const flaggedTokens: string[] = [];
  const verifiedTokens: VerifiedTokenInfo[] = [];

  // 1. First pass: Flag and redact spelled-out number phrases ("twenty", "thirty thousand")
  let processedText = text.replace(SPELLED_OUT_REGEX, (match) => {
    flaggedTokens.push(match);
    return '[not in data]';
  });

  // 2. Second pass: Numeric tokens
  // Matches currency ($123, $29.8k), percentages (20%, 57.7%), multipliers (2x), k/M numbers (29.8k), standard numbers (151, 208.67)
  const numberRegex =
    /(\$\s*[\d,]+(?:\.\d+)?\s*[kKmM]?|[\d,]+(?:\.\d+)?\s*%|[\d,]+(?:\.\d+)?\s*[xX]|[\d,]+(?:\.\d+)?\s*[kKmM]|\b[\d,]+(?:\.\d+)?\b)/g;

  processedText = processedText.replace(numberRegex, (match) => {
    // Avoid double-processing if already redacted
    if (match === '[not in data]') return match;

    const isPercent = match.includes('%');
    const kmMatch = match.match(/([\d,]+(?:\.\d+)?)\s*([kKmM])/);
    const xMatch = match.match(/([\d,]+(?:\.\d+)?)\s*[xX]/);

    let num = 0;
    if (kmMatch) {
      const mult = kmMatch[2].toLowerCase() === 'm' ? 1000000 : 1000;
      num = parseFloat(kmMatch[1].replace(/,/g, '')) * mult;
    } else if (xMatch) {
      num = parseFloat(xMatch[1].replace(/,/g, ''));
    } else {
      const clean = match.replace(/[\$,%\s]/g, '');
      num = parseFloat(clean);
    }

    if (isNaN(num)) {
      return match;
    }

    // Check against all context entries
    let matchedEntry: ContextNumberEntry | null = null;
    for (const entry of contextEntries) {
      if (matchesContextEntry(num, match, entry, isPercent)) {
        matchedEntry = entry;
        break;
      }
    }

    if (matchedEntry) {
      verifiedTokens.push({
        token: match,
        matchedKey: matchedEntry.keyPath,
        metricCategory: categorizeMetricKey(matchedEntry.keyPath),
      });
      return match;
    }

    // Not matched in context
    flaggedTokens.push(match);
    return '[not in data]';
  });

  // Determine primary metric category for the whole response (for "Where did that number come from?")
  let primaryCategory: 'pricing' | 'revenue' | 'amenity' | 'compliance' | 'outlook' | 'general' =
    'pricing';
  if (verifiedTokens.length > 0) {
    const counts: Record<string, number> = {};
    verifiedTokens.forEach((v) => {
      counts[v.metricCategory] = (counts[v.metricCategory] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    primaryCategory = sorted[0][0] as any;
  }

  return {
    sanitizedText: processedText,
    flaggedTokens,
    verifiedTokens,
    verified: flaggedTokens.length === 0,
    primaryMetricCategory: primaryCategory,
  };
}
