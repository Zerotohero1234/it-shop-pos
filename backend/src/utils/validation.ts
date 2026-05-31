/**
 * Validation Utility Functions
 * Helper functions for input validation used across controllers
 */

/**
 * Check that all required fields are present and non-empty in a request body
 * Returns the first missing field name, or null if all present
 */
export function checkRequired(body: Record<string, any>, fields: string[]): string | null {
  for (const field of fields) {
    const val = body[field];
    if (val === undefined || val === null || String(val).trim() === '') {
      return field;
    }
  }
  return null;
}

/**
 * Validate username: 3–50 chars, letters/numbers/underscore only
 */
export function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,50}$/.test(username);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone: digits, spaces, hyphens, +, (), 7–20 chars
 */
export function isValidPhone(phone: string): boolean {
  return /^[+\d\s\-()]{7,20}$/.test(phone);
}

/**
 * Validate password minimum length
 */
export function isValidPassword(password: string, minLength = 6): boolean {
  return typeof password === 'string' && password.length >= minLength;
}

/**
 * Parse and validate a positive integer (for IDs, page numbers, etc.)
 * Returns the parsed number or null if invalid
 */
export function parsePositiveInt(value: any): number | null {
  const num = parseInt(String(value), 10);
  return Number.isInteger(num) && num > 0 ? num : null;
}

/**
 * Sanitize a string: trim whitespace
 */
export function sanitize(value: string): string {
  return String(value).trim();
}
