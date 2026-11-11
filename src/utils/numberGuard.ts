/**
 * Number Guard for AI Safety
 * Scans generated AI text, extracts numeric tokens, and verifies each one
 * against the numbers present in the context JSON.
 * Replaces unverified numbers with "[not in data]".
 */

export interface NumberGuardResult {
  sanitizedText: string;
  flaggedTokens: string[];
  verified: boolean;
}

/**
 * Recursively extracts all numeric values from a JSON context object
 */
export function extractNumbersFromContext(context: any): number[] {
  const numbers: number[] = [];

  function recurse(val: any) {
    if (val === null || val === undefined) return;
    if (typeof val === 'number' && !isNaN(val)) {
      numbers.push(val);
    } else if (typeof val === 'string') {
      const num = parseFloat(val.replace(/[^0-9.-]/g, ''));
      if (!isNaN(num)) numbers.push(num);
    } else if (Array.isArray(val)) {
      val.forEach(recurse);
    } else if (typeof val === 'object') {
      Object.values(val).forEach(recurse);
    }
  }

  recurse(context);
  return numbers;
}

/**
 * Checks if a candidate number is valid against context numbers
 * Tolerance: ±0.5 for whole numbers, ±1% for general values/percentages
 */
export function isNumberInContext(candidate: number, contextNumbers: number[]): boolean {
  // Allow structural constants like current year and scrape date components
  const structuralAllowed = [2026, 2027, 20, 19, 9, 12, 1, 2, 3, 4];
  if (structuralAllowed.includes(candidate)) {
    return true;
  }

  for (const ctx of contextNumbers) {
    // Exact match
    if (Math.abs(candidate - ctx) < 0.001) return true;

    // Tolerance ±0.5 for integers/rounded values
    if (Math.abs(candidate - ctx) <= 0.5) return true;

    // Percentage match (e.g. 0.45 in context vs 45 or 45% in text)
    if (Math.abs(candidate - ctx * 100) <= 1.0) return true;
    if (Math.abs(candidate * 100 - ctx) <= 1.0) return true;

    // Relative ±1% tolerance for large dollar amounts or estimates
    if (ctx > 0 && Math.abs(candidate - ctx) / ctx <= 0.01) return true;
  }

  return false;
}

/**
 * Inspects generated AI response and enforces Number Guard
 */
export function enforceNumberGuard(
  text: string,
  contextJson: any
): NumberGuardResult {
  if (!text) {
    return { sanitizedText: '', flaggedTokens: [], verified: true };
  }

  const contextNumbers = extractNumbersFromContext(contextJson);
  const flaggedTokens: string[] = [];

  // Regex to match numbers: currency ($123.45), percentages (45.2%), or standalone numbers
  // Exclude markdown headings or pure letters
  const numberRegex = /(\$\s*[\d,]+(?:\.\d+)?|\b[\d,]+(?:\.\d+)?%|\b[\d,]+(?:\.\d+)?\b)/g;

  const sanitizedText = text.replace(numberRegex, (match) => {
    // Remove $, %, commas to parse raw numeric value
    const cleanStr = match.replace(/[\$,%]/g, '').trim();
    const num = parseFloat(cleanStr);

    if (isNaN(num)) {
      return match;
    }

    const isValid = isNumberInContext(num, contextNumbers);
    if (!isValid) {
      flaggedTokens.push(match);
      return '[not in data]';
    }

    return match;
  });

  return {
    sanitizedText,
    flaggedTokens,
    verified: flaggedTokens.length === 0,
  };
}
