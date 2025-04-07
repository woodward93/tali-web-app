// Format number with thousand separators and 2 decimal places
export function formatCurrency(value: number, currency?: string): string {
  // If no currency is provided, return just the formatted number
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  
  if (!currency) return formattedNumber;
  
  // Extract just the currency code from formats like "USD - United States Dollar"
  const currencyCode = currency.split(' - ')[0];
  
  // Place currency code before the amount without a space
  return `${currencyCode}${formattedNumber}`;
}