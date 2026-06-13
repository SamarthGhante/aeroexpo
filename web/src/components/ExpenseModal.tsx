import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import type { Expense } from '../types';
import { toLocalDateString } from '../types';
import { ApiError } from '../api';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenseToEdit: Expense | null;
  onSubmit: (expenseData: { title: string; amount: number; category: string; date: string; notes: string }) => Promise<void>;
  currency: string;
}

const PRESET_CATEGORIES = [
  'Food',
  'Travel',
  'Utilities',
  'Software',
  'Office',
  'Entertainment',
  'Marketing',
];

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  expenseToEdit,
  onSubmit,
  currency,
}) => {
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState(''); // text input to allow decimal points
  const [category, setCategory] = useState(PRESET_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<{ message: string; field?: string } | null>(null);

  // Sync inputs on open/edit change
  useEffect(() => {
    if (expenseToEdit) {
      setTitle(expenseToEdit.title);
      setAmountStr((expenseToEdit.amount / 100).toFixed(2));
      setDate(expenseToEdit.date);
      setNotes(expenseToEdit.notes || '');
      
      const isPreset = PRESET_CATEGORIES.includes(expenseToEdit.category);
      if (isPreset) {
        setCategory(expenseToEdit.category);
        setIsCustomCategory(false);
      } else {
        setCategory('Custom');
        setCustomCategory(expenseToEdit.category);
        setIsCustomCategory(true);
      }
    } else {
      // Set defaults for new expense
      setTitle('');
      setAmountStr('');
      setCategory(PRESET_CATEGORIES[0]);
      setCustomCategory('');
      setIsCustomCategory(false);
      setNotes('');
      
      // Default to today's date in YYYY-MM-DD using local timezone helper
      const today = toLocalDateString(new Date());
      setDate(today);
    }

    setApiError(null);
  }, [expenseToEdit, isOpen]);

  if (!isOpen) return null;

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCategory(val);
    setIsCustomCategory(val === 'Custom');
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setApiError(null);

    // Convert decimal string to integer cents
    const floatAmount = parseFloat(amountStr);
    if (isNaN(floatAmount) || floatAmount <= 0) {
      setApiError({
        message: 'Amount must be a valid positive number.',
        field: 'amount',
      });
      setSubmitting(false);
      return;
    }
    
    // Check decimal points to avoid rounding errors
    const centsAmount = Math.round(floatAmount * 100);

    const finalCategory = isCustomCategory ? customCategory.trim() : category;

    if (!title.trim()) {
      setApiError({ message: 'Title is required.', field: 'title' });
      setSubmitting(false);
      return;
    }

    if (!finalCategory) {
      setApiError({ message: 'Category is required.', field: 'category' });
      setSubmitting(false);
      return;
    }

    if (!date) {
      setApiError({ message: 'Date is required.', field: 'date' });
      setSubmitting(false);
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        amount: centsAmount,
        category: finalCategory,
        date,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError({
          message: err.message,
          field: err.field,
        });
      } else {
        setApiError({
          message: 'An unexpected error occurred. Please try again.',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-dialog">
        <div className="modal-header">
          <h3 className="modal-title">
            {expenseToEdit ? 'Edit Expense' : 'Add New Expense'}
          </h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleFormSubmit}>
          <div className="modal-body">
            {/* General API error if no field is specified */}
            {apiError && !apiError.field && (
              <div className="form-error-msg" style={{ marginBottom: '16px', padding: '10px', background: 'var(--error-bg)', borderRadius: 'var(--border-radius-sm)' }}>
                <AlertCircle size={16} />
                <span>{apiError.message}</span>
              </div>
            )}

            {/* Title */}
            <div className={`form-group ${apiError?.field === 'title' ? 'has-error' : ''}`}>
              <label className="form-label" htmlFor="expense-title">Title</label>
              <input
                id="expense-title"
                type="text"
                className="input-control"
                placeholder="e.g. Desk Chair"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                autoFocus
              />
              {apiError?.field === 'title' && (
                <div className="form-error-msg">
                  <AlertCircle size={14} />
                  <span>{apiError.message}</span>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className={`form-group ${apiError?.field === 'amount' ? 'has-error' : ''}`}>
              <label className="form-label" htmlFor="expense-amount">Amount ({currency})</label>
              <input
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                className="input-control"
                placeholder="e.g. 149.99"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                disabled={submitting}
              />
              {apiError?.field === 'amount' && (
                <div className="form-error-msg">
                  <AlertCircle size={14} />
                  <span>{apiError.message}</span>
                </div>
              )}
            </div>

            {/* Category Select */}
            <div className={`form-group ${apiError?.field === 'category' ? 'has-error' : ''}`}>
              <label className="form-label" htmlFor="expense-category">Category</label>
              <select
                id="expense-category"
                className="input-control"
                value={isCustomCategory ? 'Custom' : category}
                onChange={handleCategoryChange}
                disabled={submitting}
              >
                {PRESET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
                <option value="Custom">Custom Category...</option>
              </select>
              {apiError?.field === 'category' && !isCustomCategory && (
                <div className="form-error-msg">
                  <AlertCircle size={14} />
                  <span>{apiError.message}</span>
                </div>
              )}
            </div>

            {/* Custom Category Input */}
            {isCustomCategory && (
              <div className={`form-group ${apiError?.field === 'category' ? 'has-error' : ''}`} style={{ marginTop: '-8px' }}>
                <label className="form-label" htmlFor="expense-custom-category">Custom Category Name</label>
                <input
                  id="expense-custom-category"
                  type="text"
                  className="input-control"
                  placeholder="e.g. Insurance"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  disabled={submitting}
                />
                {apiError?.field === 'category' && (
                  <div className="form-error-msg">
                    <AlertCircle size={14} />
                    <span>{apiError.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* Date */}
            <div className={`form-group ${apiError?.field === 'date' ? 'has-error' : ''}`}>
              <label className="form-label" htmlFor="expense-date">Date</label>
              <input
                id="expense-date"
                type="date"
                className="input-control"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={submitting}
              />
              {apiError?.field === 'date' && (
                <div className="form-error-msg">
                  <AlertCircle size={14} />
                  <span>{apiError.message}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className={`form-group ${apiError?.field === 'notes' ? 'has-error' : ''}`}>
              <label className="form-label" htmlFor="expense-notes">Notes (Optional)</label>
              <textarea
                id="expense-notes"
                className="input-control"
                placeholder="e.g. Purchased from local dealer, warranty 2 years"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting}
                rows={3}
                style={{ resize: 'vertical', minHeight: '80px' }}
              />
              {apiError?.field === 'notes' && (
                <div className="form-error-msg">
                  <AlertCircle size={14} />
                  <span>{apiError.message}</span>
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : expenseToEdit ? 'Save Changes' : 'Create Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
