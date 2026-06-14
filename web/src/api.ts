import type { Expense, Summary, FilterParams, ValidationError } from './types';

export class ApiError extends Error {
  status: number;
  field?: string;

  constructor(status: number, message: string, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
  }
}

/**
 * Handle API responses and throw a structured ApiError if they are not OK.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    // 204 No Content has no JSON body
    if (response.status === 204) {
      return {} as T;
    }
    return response.json() as Promise<T>;
  }

  let errorMessage = 'An unexpected error occurred';
  let field: string | undefined;

  try {
    const errorBody = (await response.json()) as ValidationError;
    errorMessage = errorBody.error || errorMessage;
    field = errorBody.field;
  } catch {
    // If the error response isn't JSON
    errorMessage = await response.text();
  }

  throw new ApiError(response.status, errorMessage, field);
}

const getBaseUrl = (): string => {
  const savedUrl = typeof localStorage !== 'undefined' ? localStorage.getItem('aeroexpo_api_url') : null;
  if (savedUrl) return savedUrl;

  // Fallback to environment variable if set
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) return envUrl;

  // Detect if running inside Capacitor native webview
  const isNative = typeof window !== 'undefined' && (window as any).Capacitor;
  if (isNative) {
    // Return Android Emulator host address as default fallback, or hosted fallback if available
    return 'http://10.0.2.2:8080';
  }

  return ''; // Relative path for browser web deployment (same-origin)
};

const getUrl = (path: string): string => {
  const base = getBaseUrl();
  if (!base) return path.startsWith('/') ? path : `/${path}`;
  const cleanBase = base.replace(/\/$/, '');
  const cleanPath = path.replace(/^\//, '');
  return `${cleanBase}/${cleanPath}`;
};

export const api = {
  /**
   * Get list of expenses with optional query filters.
   */
  async getExpenses(filters: FilterParams = {}): Promise<Expense[]> {
    const query = new URLSearchParams();
    if (filters.category) query.append('category', filters.category);
    if (filters.start_date) query.append('start_date', filters.start_date);
    if (filters.end_date) query.append('end_date', filters.end_date);
    if (filters.limit !== undefined) query.append('limit', String(filters.limit));
    if (filters.offset !== undefined) query.append('offset', String(filters.offset));

    const queryString = query.toString();
    const url = getUrl(`/expenses${queryString ? `?${queryString}` : ''}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    return handleResponse<Expense[]>(response);
  },

  /**
   * Fetch a single expense by ID.
   */
  async getExpense(id: string): Promise<Expense> {
    const response = await fetch(getUrl(`/expenses/${id}`), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    return handleResponse<Expense>(response);
  },

  /**
   * Create a new expense.
   */
  async createExpense(expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>): Promise<Expense> {
    const response = await fetch(getUrl('/expenses'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(expense),
    });

    return handleResponse<Expense>(response);
  },

  /**
   * Update an existing expense.
   */
  async updateExpense(id: string, expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>): Promise<Expense> {
    const response = await fetch(getUrl(`/expenses/${id}`), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(expense),
    });

    return handleResponse<Expense>(response);
  },

  /**
   * Delete an expense by ID.
   */
  async deleteExpense(id: string): Promise<void> {
    const response = await fetch(getUrl(`/expenses/${id}`), {
      method: 'DELETE',
    });

    await handleResponse<void>(response);
  },

  /**
   * Get the spending summary aggregates.
   */
  async getSummary(startDate?: string, endDate?: string): Promise<Summary> {
    const query = new URLSearchParams();
    if (startDate) query.append('start_date', startDate);
    if (endDate) query.append('end_date', endDate);

    const queryString = query.toString();
    const url = getUrl(`/expenses/summary${queryString ? `?${queryString}` : ''}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    return handleResponse<Summary>(response);
  },
};
