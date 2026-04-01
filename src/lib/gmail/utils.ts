/**
 * Gmail utility helpers
 */

/**
 * Parse sender info from an email's from_address field.
 * Handles both "Display Name <email@domain.com>" and plain "email@domain.com" formats.
 */
export function parseSenderInfo(fromAddress: string): {
  email: string;
  domain: string;
  displayName: string;
} {
  // Handle "Display Name <email@domain.com>" format
  const match = fromAddress.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return {
      displayName: match[1].replace(/^["']|["']$/g, '').trim(),
      email: match[2].toLowerCase(),
      domain: match[2].split('@')[1]?.toLowerCase() || '',
    };
  }
  // Plain email
  const email = fromAddress.toLowerCase().trim();
  return {
    displayName: email.split('@')[0],
    email,
    domain: email.split('@')[1] || '',
  };
}
