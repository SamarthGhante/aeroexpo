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
    const url = `/expenses${queryString ? `?${queryString}` : ''}`;

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
    const response = await fetch(`/expenses/${id}`, {
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
    const response = await fetch('/expenses', {
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
    const response = await fetch(`/expenses/${id}`, {
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
    const response = await fetch(`/expenses/${id}`, {
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
    const url = `/expenses/summary${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    return handleResponse<Summary>(response);
  },
};
