/**
 * Parse amount from Vinted email text
 * Handles formats like "25,00 €", "1.234,50 EUR", etc.
 */
export function parseVintedAmount(text: string): number | null {
  // Regex to match amounts: digits with dots/commas, followed by € or EUR
  const regex = /([\d.,]+)\s*(€|EUR)/i;
  const match = text.match(regex);

  if (!match) {
    return null;
  }

  const amountStr = match[1];

  // Handle European format: "1.234,50" or "25,00"
  // Replace dots (thousands separator) with nothing, then replace comma with dot
  const normalized = amountStr.replace(/\./g, "").replace(",", ".");

  const amount = parseFloat(normalized);

  if (isNaN(amount)) {
    return null;
  }

  return amount;
}

/**
 * Filter emails from the last N days
 */
export function filterEmailsByDate(
  emails: Array<{ date: string }>,
  days: number = 7
): Array<{ date: string }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return emails.filter((email) => {
    const emailDate = new Date(email.date);
    return emailDate >= cutoffDate;
  });
}

/**
 * Calculate weekly summary from email details
 */
export function calculateWeeklySummary(
  details: Array<{
    messageId: string;
    amount: number;
    date: string;
    snippet: string;
  }>
): {
  total: number;
  count: number;
  weeklyTotal: number;
  weeklyCount: number;
  details: typeof details;
} {
  const weeklyEmails = filterEmailsByDate(details, 7);

  const total = details.reduce((sum, email) => sum + email.amount, 0);
  const weeklyTotal = weeklyEmails.reduce(
    (sum, email) => sum + email.amount,
    0
  );

  return {
    total,
    count: details.length,
    weeklyTotal,
    weeklyCount: weeklyEmails.length,
    details,
  };
}

