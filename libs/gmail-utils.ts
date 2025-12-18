/**
 * Parse transaction ID from Vinted email text
 * Busca el número de transacción que es siempre numérico (ej: 16606466410)
 */
export function parseTransactionId(text: string): string | null {
  // Múltiples patrones para encontrar el transactionId
  const patterns = [
    // "N.º de transacción: #16606466410" o "N.º de transacción: 16606466410"
    /N\.?\s*º?\s*de transacción:\s*#?(\d{8,})/i,
    // "transacción: 16606466410"
    /transacción:\s*#?(\d{8,})/i,
    // En HTML puede estar separado
    /transacci[oó]n[^0-9]*(\d{8,})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Parse amount from Vinted email text
 * Busca específicamente el monto de "Transferencia a tu saldo Vinted"
 */
export function parseVintedAmount(text: string): number | null {
  // Primero buscar específicamente "Transferencia a tu saldo Vinted" seguido del monto
  const transferRegex = /Transferencia a tu saldo Vinted[\s\S]*?([\d.,]+)\s*(€|EUR)/i;
  const transferMatch = text.match(transferRegex);

  if (transferMatch) {
    const amountStr = transferMatch[1];
    const normalized = amountStr.replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(normalized);
    if (!isNaN(amount)) {
      return amount;
    }
  }

  // Alternativa: buscar "saldo Vinted" con el monto
  const saldoRegex = /saldo Vinted[:\s]*([\d.,]+)\s*(€|EUR)/i;
  const saldoMatch = text.match(saldoRegex);

  if (saldoMatch) {
    const amountStr = saldoMatch[1];
    const normalized = amountStr.replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(normalized);
    if (!isNaN(amount)) {
      return amount;
    }
  }

  // Buscar en formato HTML
  const htmlRegex = /Transferencia[^>]*>[\s\S]*?<[^>]*>([\d.,]+)\s*(€|EUR)/i;
  const htmlMatch = text.match(htmlRegex);

  if (htmlMatch) {
    const amountStr = htmlMatch[1];
    const normalized = amountStr.replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(normalized);
    if (!isNaN(amount)) {
      return amount;
    }
  }

  // Fallback: buscar cualquier monto en formato europeo
  const fallbackRegex = /([\d]{1,3}(?:\.[\d]{3})*(?:,[\d]{2})?|[\d]+(?:,[\d]{2})?)\s*(€|EUR)/g;
  const matches = [...text.matchAll(fallbackRegex)];
  
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    const amountStr = lastMatch[1];
    const normalized = amountStr.replace(/\./g, "").replace(",", ".");
    const amount = parseFloat(normalized);
    if (!isNaN(amount)) {
      return amount;
    }
  }

  return null;
}

/**
 * Parse shipping carrier from email text
 */
export function parseShippingCarrier(text: string): string {
  const textLower = text.toLowerCase();
  
  if (textLower.includes("correos") || textLower.includes("correos domicilio")) {
    return "correos";
  }
  if (textLower.includes("inpost")) {
    return "inpost";
  }
  if (textLower.includes("seur") || textLower.includes("shop2shop")) {
    return "seur";
  }
  if (textLower.includes("vinted go")) {
    return "vintedgo";
  }
  
  return "unknown";
}

/**
 * Parse tracking number from email text
 */
export function parseTrackingNumber(text: string): string {
  // Buscar N.º de seguimiento: seguido del número
  const trackingRegex = /N\.?\s*º?\s*de seguimiento:\s*([A-Za-z0-9]+)/i;
  const match = text.match(trackingRegex);
  
  if (match) {
    return match[1].trim();
  }
  
  return "";
}

/**
 * Parse shipping deadline from email text
 */
export function parseShippingDeadline(text: string): string {
  // Fecha límite de envío: DD/MM/YYYY, HH:MM
  const deadlineRegex =
    /Fecha l[ií]mite de env[ií]o:\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})\s*,?\s*(\d{1,2})\s*:\s*(\d{2})/i;

  const match = text.match(deadlineRegex);

  if (match) {
    const [, day, month, year, hour, minute] = match;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );

    return date.toISOString();
  }

  // Fallback sin hora
  const altRegex =
    /Fecha l[ií]mite[^:]*:\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/i;

  const altMatch = text.match(altRegex);

  if (altMatch) {
    const [, day, month, year] = altMatch;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      23,
      59
    );
    return date.toISOString();
  }

  return "";
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
 * Filter emails by date range
 */
export function filterEmailsByDateRange(
  emails: Array<{ date: string }>,
  startDate: Date,
  endDate: Date
): Array<{ date: string }> {
  return emails.filter((email) => {
    const emailDate = new Date(email.date);
    return emailDate >= startDate && emailDate <= endDate;
  });
}

/**
 * Calculate summary from email details with date filtering
 */
export function calculateWeeklySummary(
  details: Array<{
    messageId: string;
    amount: number;
    date: string;
    snippet: string;
    itemName?: string;
    transactionId?: string;
  }>
): {
  total: number;
  count: number;
  weeklyTotal: number;
  weeklyCount: number;
  monthlyTotal: number;
  monthlyCount: number;
  details: typeof details;
} {
  const weeklyEmails = filterEmailsByDate(details, 7);
  const monthlyEmails = filterEmailsByDate(details, 30);

  const total = details.reduce((sum, email) => sum + email.amount, 0);
  const weeklyTotal = weeklyEmails.reduce(
    (sum, email) => sum + email.amount,
    0
  );
  const monthlyTotal = monthlyEmails.reduce(
    (sum, email) => sum + email.amount,
    0
  );

  return {
    total,
    count: details.length,
    weeklyTotal,
    weeklyCount: weeklyEmails.length,
    monthlyTotal,
    monthlyCount: monthlyEmails.length,
    details,
  };
}

/**
 * Group sales by month
 */
export function groupSalesByMonth(
  details: Array<{
    date: string;
    amount: number;
  }>
): Record<string, { count: number; total: number }> {
  const grouped: Record<string, { count: number; total: number }> = {};

  for (const detail of details) {
    const date = new Date(detail.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!grouped[monthKey]) {
      grouped[monthKey] = { count: 0, total: 0 };
    }

    grouped[monthKey].count += 1;
    grouped[monthKey].total += detail.amount;
  }

  return grouped;
}

/**
 * Group sales by day
 */
export function groupSalesByDay(
  details: Array<{
    date: string;
    amount: number;
  }>
): Record<string, { count: number; total: number }> {
  const grouped: Record<string, { count: number; total: number }> = {};

  for (const detail of details) {
    const date = new Date(detail.date);
    const dayKey = date.toISOString().split('T')[0];

    if (!grouped[dayKey]) {
      grouped[dayKey] = { count: 0, total: 0 };
    }

    grouped[dayKey].count += 1;
    grouped[dayKey].total += detail.amount;
  }

  return grouped;
}

/**
 * Get carrier display name
 */
export function getCarrierDisplayName(carrier: string): string {
  const carriers: Record<string, string> = {
    correos: "Correos",
    inpost: "InPost",
    seur: "SEUR",
    vintedgo: "Vinted Go",
    unknown: "Desconocido",
  };
  return carriers[carrier] || carrier;
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: string): string {
  const statuses: Record<string, string> = {
    pending: "Pendiente",
    completed: "Completada",
    cancelled: "Cancelada",
  };
  return statuses[status] || status;
}

/**
 * Check if a sale is truly pending (within shipping deadline)
 */
export function isTrulyPending(saleDate: Date, shippingDeadline: Date | null): boolean {
  const now = new Date();
  
  // Si no hay fecha de vencimiento, considerar pendiente si es de los últimos 7 días
  if (!shippingDeadline) {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return saleDate >= sevenDaysAgo;
  }
  
  // Si la fecha actual está entre la fecha de venta y la fecha de vencimiento
  return now >= saleDate && now <= shippingDeadline;
}

/**
 * Parse expense category from Vinted email text
 */
export function parseExpenseCategory(text: string, subject: string): "destacado" | "armario" | "otros" {
  const textLower = text.toLowerCase();
  const subjectLower = subject.toLowerCase();
  
  if (textLower.includes("destacado") || subjectLower.includes("destacado")) {
    return "destacado";
  }
  if (textLower.includes("armario") || subjectLower.includes("armario")) {
    return "armario";
  }
  
  return "otros";
}

/**
 * Parse expense amount from Vinted email text
 * Busca montos en formato europeo (ej: 7,08 €)
 */
export function parseExpenseAmount(text: string): { amount: number; discount: number; total: number } | null {
  let amount = 0;
  let discount = 0;
  
  // Buscar "Total" o similar
  const totalRegex = /(?:Total|Saldo Vinted)[:\s]*([\d.,]+)\s*(€|EUR)/i;
  const totalMatch = text.match(totalRegex);
  
  if (totalMatch) {
    const amountStr = totalMatch[1];
    const normalized = amountStr.replace(/\./g, "").replace(",", ".");
    amount = parseFloat(normalized);
  }
  
  // Buscar descuento
  const discountRegex = /Descuento[:\s]*-?\s*([\d.,]+)\s*(€|EUR)/i;
  const discountMatch = text.match(discountRegex);
  
  if (discountMatch) {
    const discountStr = discountMatch[1];
    const normalized = discountStr.replace(/\./g, "").replace(",", ".");
    discount = parseFloat(normalized);
  }
  
  // Si no encontramos total, buscar cualquier monto
  if (amount === 0) {
    const amountRegex = /([\d]{1,3}(?:,[\d]{2})?)\s*(€|EUR)/;
    const amountMatch = text.match(amountRegex);
    
    if (amountMatch) {
      const amountStr = amountMatch[1];
      const normalized = amountStr.replace(",", ".");
      amount = parseFloat(normalized);
    }
  }
  
  if (amount === 0) {
    return null;
  }
  
  const total = amount - discount;
  
  return { amount, discount, total };
}

/**
 * Parse item count from Vinted expense email
 * Busca "X artículos" o similar
 */
export function parseItemCount(text: string): number {
  const patterns = [
    /(\d+)\s*art[ií]culos?/i,
    /destacado.*?(\d+)\s*art/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return parseInt(match[1]);
    }
  }
  
  return 0;
}