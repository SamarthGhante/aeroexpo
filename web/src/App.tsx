import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Trash2,
  Edit,
  SlidersHorizontal,
  RefreshCw,
  Wallet,
  AlertTriangle,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Settings,
} from 'lucide-react';

import { api } from './api';
import type { Expense, Summary, FilterParams } from './types';
import { CURRENCY_OPTIONS, toLocalDateString } from './types';
import { MetricCards } from './components/MetricCards';
import { CategoryChart, getColorForCategory } from './components/CategoryChart';
import { ExpenseModal } from './components/ExpenseModal';
import { CalendarView } from './components/CalendarView';
import { ConfirmationModal } from './components/ConfirmationModal';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

function App() {
  // Data State
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Settings State
  const [currency, setCurrency] = useState<string>(() => localStorage.getItem('aeroexpo_currency') || 'USD');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Filters State
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting State
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'title'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination State
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Confirmation Dialogue State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmConfig({
      isOpen: true,
      ...options,
    });
  };

  // Toast State
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Show Toast Toast Notification
  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Fetch Data Function
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: FilterParams = {
        limit,
        offset,
      };

      if (categoryFilter) filters.category = categoryFilter;
      
      if (startDateFilter) filters.start_date = startDateFilter;
      if (endDateFilter) filters.end_date = endDateFilter;

      const [expensesData, summaryData] = await Promise.all([
        api.getExpenses(filters),
        api.getSummary(startDateFilter || undefined, endDateFilter || undefined),
      ]);

      setExpenses(expensesData);
      setSummary(summaryData);
    } catch (err: any) {
      setError(err.message || 'Failed to load expense data.');
      addToast('Error loading data', 'error');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, startDateFilter, endDateFilter, limit, offset, addToast]);

  // Load data on filter/page change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset pagination offset on filter change
  useEffect(() => {
    setOffset(0);
  }, [categoryFilter, startDateFilter, endDateFilter]);

  // Currency Formatter
  const formatCurrency = (cents: number) => {
    const option = CURRENCY_OPTIONS.find((o) => o.code === currency) || CURRENCY_OPTIONS[0];
    return new Intl.NumberFormat(option.locale, {
      style: 'currency',
      currency: option.code,
    }).format(cents / 100);
  };

  // Date Formatter
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Dynamic Categories from Breakdown
  const availableCategories = Object.keys(summary?.category_breakdown ?? {}).sort();

  // Handle Edit Click
  const handleEditClick = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsModalOpen(true);
  };

  // Handle Add Click
  const handleAddClick = () => {
    setExpenseToEdit(null);
    setIsModalOpen(true);
  };

  // Handle Modal Submit
  const handleModalSubmit = async (expenseData: {
    title: string;
    amount: number;
    category: string;
    date: string;
    notes: string;
  }) => {
    if (expenseToEdit) {
      // Edit mode
      await api.updateExpense(expenseToEdit.id, expenseData);
      addToast('Expense updated successfully');
    } else {
      // Create mode
      await api.createExpense(expenseData);
      addToast('Expense created successfully');
    }
    fetchData();
  };

  // Handle Delete Click
  const handleDeleteClick = (id: string) => {
    showConfirm({
      title: 'Delete Expense',
      message: 'Are you sure you want to delete this expense? This action cannot be undone.',
      confirmText: 'Delete',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.deleteExpense(id);
          addToast('Expense deleted successfully');
          fetchData();
        } catch (err: any) {
          addToast(err.message || 'Failed to delete expense', 'error');
        }
      },
    });
  };

  // Handle Reset View (Resets settings, currency, and filters)
  const handleResetView = () => {
    setSearchQuery('');
    setCategoryFilter('');
    setStartDateFilter('');
    setEndDateFilter('');
    setCurrency('USD');
    localStorage.setItem('aeroexpo_currency', 'USD');
    setOffset(0);
    setIsSettingsOpen(false);
    addToast('View and settings reset successfully');
  };

  // Handle Clear All Data (Database Reset)
  const handleClearAllData = () => {
    showConfirm({
      title: 'Clear Database Data',
      message: 'WARNING: This will permanently delete ALL expenses from the database. This action cannot be undone. Are you sure?',
      confirmText: 'Clear All',
      isDanger: true,
      onConfirm: async () => {
        try {
          setLoading(true);
          // Fetch list up to 1000 items to delete them
          const allExpenses = await api.getExpenses({ limit: 1000 });
          if (allExpenses.length === 0) {
            addToast('No database expenses to clear');
            setIsSettingsOpen(false);
            return;
          }
          await Promise.all(allExpenses.map((e) => api.deleteExpense(e.id)));
          addToast('All database data cleared successfully');
          setIsSettingsOpen(false);
          fetchData();
        } catch (err: any) {
          addToast(err.message || 'Failed to clear database data', 'error');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Client Side Search Filter and Sorting
  const filteredExpenses = expenses
    .filter((e) => {
      const matchSearch =
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = a.date.localeCompare(b.date);
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const handleSort = (field: 'date' | 'amount' | 'title') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc'); // Default to descending
    }
  };

  // Preset quick ranges
  const setQuickRange = (range: 'this-month' | 'last-30' | 'all') => {
    const today = new Date();
    if (range === 'this-month') {
      const startOfMonth = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
      const endOfMonth = toLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
      setStartDateFilter(startOfMonth);
      setEndDateFilter(endOfMonth);
    } else if (range === 'last-30') {
      const priorDate = toLocalDateString(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
      const todayStr = toLocalDateString(today);
      setStartDateFilter(priorDate);
      setEndDateFilter(todayStr);
    } else {
      setStartDateFilter('');
      setEndDateFilter('');
    }
  };

  return (
    <>
      {/* Header Bar */}
      <header className="header">
        <div className="header-container">
          <h1 className="logo">
            <Wallet size={24} />
            <span>AEROEXPO</span>
          </h1>
          <div className="flex gap-12 align-center">
            <button className="btn btn-primary" onClick={handleAddClick}>
              <Plus size={16} />
              Log Expense
            </button>
            <div className="settings-menu-container">
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                style={{ padding: '10px' }}
                title="Settings"
              >
                <Settings size={18} />
              </button>
              {isSettingsOpen && (
                <div className="settings-dropdown">
                  <h4 className="settings-title">AeroExpo Settings</h4>
                  <div className="settings-item">
                    <label className="settings-label" htmlFor="settings-currency">Display Currency</label>
                    <select
                      id="settings-currency"
                      className="input-control"
                      value={currency}
                      onChange={(e) => {
                        setCurrency(e.target.value);
                        localStorage.setItem('aeroexpo_currency', e.target.value);
                        addToast(`Currency changed to ${e.target.value}`);
                      }}
                      style={{ fontSize: '13px', padding: '6px 12px' }}
                    >
                      {CURRENCY_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.code} ({opt.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="settings-item flex flex-col gap-8" style={{ marginTop: '16px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary w-full"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={handleResetView}
                    >
                      Reset View & Currency
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger w-full"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={handleClearAllData}
                    >
                      Clear All Database Data
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="container">
        {/* KPI Dashboard Row */}
        <MetricCards expenses={expenses} summary={summary} currency={currency} />

        {/* Filters and Controls Card */}
        <div className="section-card" style={{ marginBottom: '24px' }}>
          <div className="section-header">
            <span className="section-title">
              <SlidersHorizontal size={18} />
              Filter & Search Controls
            </span>
            <div className="flex gap-8">
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setQuickRange('this-month')}
              >
                This Month
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setQuickRange('last-30')}
              >
                Last 30 Days
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '12px' }}
                onClick={() => setQuickRange('all')}
              >
                Clear Ranges
              </button>
              <button
                className="btn-icon"
                onClick={fetchData}
                disabled={loading}
                title="Refresh Data"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="controls-row">
            {/* Search */}
            <div className="search-input-wrapper">
              <Search size={16} />
              <input
                type="text"
                className="input-control"
                placeholder="Search description or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Category Filter */}
            <div style={{ minWidth: '160px' }}>
              <select
                className="input-control"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All Categories</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filters */}
            <div className="flex align-center gap-8">
              <input
                type="date"
                className="input-control"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                style={{ width: '150px' }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>to</span>
              <input
                type="date"
                className="input-control"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                style={{ width: '150px' }}
              />
            </div>
          </div>
        </div>

        {/* Dashboard Columns Layout */}
        <div className="dashboard-layout">
          {/* Expenses List column */}
          <div className="section-card">
            <h3 className="section-title" style={{ marginBottom: '20px' }}>
              <TrendingUp size={18} />
              Transactions Registry
            </h3>

            {loading && expenses.length === 0 ? (
              <div className="empty-state">
                <RefreshCw className="empty-state-icon animate-spin" size={36} />
                <h4 className="empty-state-title">Retrieving expenses...</h4>
                <p className="empty-state-desc">Connecting to high-performance database.</p>
              </div>
            ) : error ? (
              <div className="empty-state">
                <AlertTriangle className="empty-state-icon" size={36} style={{ color: 'var(--error)' }} />
                <h4 className="empty-state-title">Database query failed</h4>
                <p className="empty-state-desc">{error}</p>
                <button className="btn btn-primary" onClick={fetchData}>
                  Retry Query
                </button>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="empty-state">
                <AlertTriangle className="empty-state-icon" size={36} />
                <h4 className="empty-state-title">No expenses found</h4>
                <p className="empty-state-desc">
                  Try clearing your filters or create a new expense.
                </p>
                {!searchQuery && !categoryFilter && !startDateFilter && (
                  <button className="btn btn-primary" onClick={handleAddClick}>
                    Create Your First Expense
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSort('title')}
                        >
                          Expense Title {sortBy === 'title' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </th>
                        <th>Category</th>
                        <th
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSort('amount')}
                        >
                          Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </th>
                        <th
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleSort('date')}
                        >
                          Date {sortBy === 'date' && (sortOrder === 'asc' ? '▲' : '▼')}
                        </th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map((expense) => (
                        <tr key={expense.id}>
                          <td style={{ fontWeight: '500' }}>
                            <div className="expense-title-cell">
                              <span className="expense-title-text">{expense.title}</span>
                              {expense.notes && (
                                <span className="expense-notes-text" title={expense.notes}>
                                  {expense.notes}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              className="badge"
                              style={{
                                color: getColorForCategory(expense.category),
                                background: `${getColorForCategory(expense.category)}18`,
                              }}
                            >
                              {expense.category}
                            </span>
                          </td>
                          <td className="amount-text">{formatCurrency(expense.amount)}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {formatDate(expense.date)}
                          </td>
                          <td className="text-right">
                            <div className="flex gap-8 justify-between" style={{ display: 'inline-flex' }}>
                              <button
                                className="btn-icon edit"
                                onClick={() => handleEditClick(expense)}
                                title="Edit Expense"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                className="btn-icon danger"
                                onClick={() => handleDeleteClick(expense.id)}
                                title="Delete Expense"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Row */}
                <div className="pagination-row">
                  <span className="pagination-info">
                    Showing offset page {Math.floor(offset / limit) + 1}
                  </span>
                  <div className="flex gap-8">
                    <button
                      className="btn btn-secondary"
                      disabled={offset === 0}
                      onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </button>
                    <button
                      className="btn btn-secondary"
                      disabled={expenses.length < limit}
                      onClick={() => setOffset((prev) => prev + limit)}
                      style={{ padding: '6px 12px', fontSize: '13px' }}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Spend aggregates & Calendar column */}
          <div className="flex flex-col gap-24" style={{ gap: '24px', display: 'flex', flexDirection: 'column' }}>
            <CalendarView
              expenses={expenses}
              startDate={startDateFilter}
              endDate={endDateFilter}
              onSelectRange={(start, end) => {
                setStartDateFilter(start);
                setEndDateFilter(end);
              }}
            />
            <CategoryChart summary={summary} currency={currency} />
          </div>
        </div>
      </main>

      {/* Expense Modal */}
      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        expenseToEdit={expenseToEdit}
        onSubmit={handleModalSubmit}
        currency={currency}
      />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        cancelText={confirmConfig.cancelText}
        isDanger={confirmConfig.isDanger}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

export default App;
