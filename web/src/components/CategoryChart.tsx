import React, { useState } from 'react';
import { PieChart as ChartIcon } from 'lucide-react';
import type { Summary } from '../types';
import { CURRENCY_OPTIONS } from '../types';

interface CategoryChartProps {
  summary: Summary | null;
  currency: string;
}

const DEFAULT_COLORS: Record<string, string> = {
  food: '#10b981',        // Emerald
  travel: '#06b6d4',      // Cyan
  utilities: '#f59e0b',   // Amber
  software: '#6366f1',    // Indigo
  office: '#3b82f6',      // Blue
  entertainment: '#ec4899', // Pink
  marketing: '#f97316',   // Orange
  other: '#64748b',       // Slate
};

export const getColorForCategory = (category: string): string => {
  const normalized = category.toLowerCase().trim();
  if (DEFAULT_COLORS[normalized]) {
    return DEFAULT_COLORS[normalized];
  }

  // Deterministic HSL color based on string hash
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 65%, 60%)`;
};

export const CategoryChart: React.FC<CategoryChartProps> = ({ summary, currency }) => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  const formatCurrency = (cents: number) => {
    const option = CURRENCY_OPTIONS.find((o) => o.code === currency) || CURRENCY_OPTIONS[0];
    return new Intl.NumberFormat(option.locale, {
      style: 'currency',
      currency: option.code,
    }).format(cents / 100);
  };

  const totalSpent = summary?.total_spent ?? 0;
  const breakdown = summary?.category_breakdown ?? {};

  // Compile slices data
  const categories = Object.entries(breakdown)
    .filter(([_, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]); // Sort descending

  const totalSegments = categories.reduce((sum, [_, val]) => sum + val, 0);

  // Math variables for SVG Donut
  const R = 50; // Radius
  const C = 2 * Math.PI * R; // Circumference = ~314.159
  let accumulatedCents = 0;

  const slices = categories.map(([category, amount]) => {
    const percentage = totalSegments > 0 ? (amount / totalSegments) * 100 : 0;
    const strokeDashArray = `${(amount / totalSegments) * C} ${C}`;
    const strokeDashOffset = C - (accumulatedCents / totalSegments) * C;
    accumulatedCents += amount;

    return {
      category,
      amount,
      percentage,
      strokeDashArray,
      strokeDashOffset,
      color: getColorForCategory(category),
    };
  });

  // Highlight state
  const activeSlice = hoveredCategory ? slices.find(s => s.category === hoveredCategory) : null;
  const displayValue = activeSlice ? activeSlice.amount : totalSpent;
  const displayLabel = activeSlice ? activeSlice.category : 'Total Spent';

  return (
    <div className="section-card">
      <h3 className="section-title">
        <ChartIcon size={18} />
        Category Breakdown
      </h3>

      {slices.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <p className="empty-state-desc">No expense data available to visualize.</p>
        </div>
      ) : (
        <>
          <div className="chart-container">
            <svg width="180" height="180" viewBox="0 0 140 140" className="chart-svg">
              <circle
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke="var(--bg-tertiary)"
                strokeWidth="10"
              />
              {slices.map((slice) => (
                <circle
                  key={slice.category}
                  className="chart-donut-segment"
                  cx="70"
                  cy="70"
                  r={R}
                  stroke={slice.color}
                  strokeDasharray={slice.strokeDashArray}
                  strokeDashoffset={slice.strokeDashOffset}
                  onMouseEnter={() => setHoveredCategory(slice.category)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  style={{
                    opacity: hoveredCategory && hoveredCategory !== slice.category ? 0.6 : 1,
                    transform: hoveredCategory === slice.category ? 'scale(1.03)' : 'scale(1)',
                    transformOrigin: 'center',
                  }}
                />
              ))}
            </svg>
            <div className="chart-center-text">
              <span className="chart-center-val">{formatCurrency(displayValue)}</span>
              <span className="chart-center-lbl">{displayLabel}</span>
            </div>
          </div>

          <div className="chart-legend">
            {slices.map((slice) => (
              <div
                key={slice.category}
                className="legend-item"
                onMouseEnter={() => setHoveredCategory(slice.category)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  borderColor: hoveredCategory === slice.category ? 'var(--border-color-active)' : 'transparent',
                  background: hoveredCategory === slice.category ? 'rgba(255, 255, 255, 0.03)' : '',
                }}
              >
                <div className="legend-left">
                  <span
                    className="legend-color-dot"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="legend-name">{slice.category}</span>
                </div>
                <div className="flex align-center gap-8">
                  <span className="legend-value">{formatCurrency(slice.amount)}</span>
                  <span className="metric-desc">({slice.percentage.toFixed(0)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
