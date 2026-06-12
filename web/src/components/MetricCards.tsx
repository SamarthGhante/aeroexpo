import React from 'react';
import { DollarSign, Tag, TrendingUp, Hash } from 'lucide-react';
import type { Expense, Summary } from '../types';
import { CURRENCY_OPTIONS } from '../types';

interface MetricCardsProps {
  expenses: Expense[];
  summary: Summary | null;
  currency: string;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ expenses, summary, currency }) => {
  // Format cents to locale currency string
  const formatCurrency = (cents: number) => {
    const option = CURRENCY_OPTIONS.find((o) => o.code === currency) || CURRENCY_OPTIONS[0];
    return new Intl.NumberFormat(option.locale, {
      style: 'currency',
      currency: option.code,
    }).format(cents / 100);
  };

  const totalSpent = summary?.total_spent ?? 0;
  const transactionCount = expenses.length;
  const averageExpense = transactionCount > 0 ? totalSpent / transactionCount : 0;

  // Find top category
  let topCategory = 'N/A';
  let maxSpend = 0;
  if (summary?.category_breakdown) {
    Object.entries(summary.category_breakdown).forEach(([category, amount]) => {
      if (amount > maxSpend) {
        maxSpend = amount;
        topCategory = category;
      }
    });
  }

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-title">Total Spending</span>
          <div className="metric-icon">
            <DollarSign size={20} />
          </div>
        </div>
        <div className="metric-value">{formatCurrency(totalSpent)}</div>
        <div className="metric-desc">Aggregate spend for selected range</div>
      </div>

      <div className="metric-card success">
        <div className="metric-header">
          <span className="metric-title">Transactions</span>
          <div className="metric-icon">
            <Hash size={20} />
          </div>
        </div>
        <div className="metric-value">{transactionCount}</div>
        <div className="metric-desc">Count of recorded transactions</div>
      </div>

      <div className="metric-card">
        <div className="metric-header">
          <span className="metric-title">Average Expense</span>
          <div className="metric-icon">
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="metric-value">{formatCurrency(averageExpense)}</div>
        <div className="metric-desc">Average per-transaction cost</div>
      </div>

      <div className="metric-card warning">
        <div className="metric-header">
          <span className="metric-title">Top Category</span>
          <div className="metric-icon">
            <Tag size={20} />
          </div>
        </div>
        <div className="metric-value" style={{ fontSize: topCategory.length > 12 ? '24px' : '32px' }}>
          {topCategory}
        </div>
        <div className="metric-desc">
          {maxSpend > 0 ? `${formatCurrency(maxSpend)} total` : 'No categories recorded'}
        </div>
      </div>
    </div>
  );
};
