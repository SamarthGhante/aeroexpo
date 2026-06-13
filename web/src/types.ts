export interface Expense {
  id: string;
  title: string;
  amount: number; // in cents
  category: string;
  date: string; // YYYY-MM-DD
  notes?: string; // Optional notes
  created_at: string;
  updated_at: string;
}

export interface Summary {
  total_spent: number; // in cents
  category_breakdown: Record<string, number>; // category -> cents
  start_date?: string;
  end_date?: string;
}

export interface ValidationError {
  error: string;
  field?: string;
}

export interface FilterParams {
  category?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  locale: string;
}

export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: 'USD', symbol: '$', locale: 'en-US' },
  { code: 'EUR', symbol: '€', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', locale: 'en-GB' },
  { code: 'INR', symbol: '₹', locale: 'en-IN' },
  { code: 'JPY', symbol: '¥', locale: 'ja-JP' },
];

export const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

