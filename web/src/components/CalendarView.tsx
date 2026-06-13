import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Tag } from 'lucide-react';
import type { Expense } from '../types';
import { getColorForCategory } from './CategoryChart';

interface CalendarViewProps {
  expenses: Expense[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onSelectRange: (startDate: string, endDate: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  expenses,
  startDate,
  endDate,
  onSelectRange,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // Format month name
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Get number of days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Get the day of the week the first day of the month falls on
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Group expenses by date string
  const expensesByDate: Record<string, Expense[]> = {};
  expenses.forEach((e) => {
    if (!expensesByDate[e.date]) {
      expensesByDate[e.date] = [];
    }
    expensesByDate[e.date].push(e);
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (dateStr: string) => {
    if (!startDate) {
      // No range started, select this single day
      onSelectRange(dateStr, dateStr);
    } else if (startDate === endDate) {
      // A single day is currently selected
      if (dateStr === startDate) {
        // Toggle off if clicking the same day again
        onSelectRange('', '');
      } else if (dateStr < startDate) {
        // Select range from clicked date to start date
        onSelectRange(dateStr, startDate);
      } else {
        // Select range from start date to clicked date
        onSelectRange(startDate, dateStr);
      }
    } else {
      // A full range is currently selected, click starts a new single day range
      onSelectRange(dateStr, dateStr);
    }
  };

  // Compile calendar cells
  const cells = [];
  // Empty slots for alignment
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(<div key={`empty-${i}`} className="calendar-day empty" />);
  }

  // Days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    // Pad day/month for date string format
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month + 1).padStart(2, '0');
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    const dateExpenses = expensesByDate[dateStr] || [];
    const hasExpenses = dateExpenses.length > 0;

    // Range status
    const isStart = startDate === dateStr;
    const isEnd = endDate === dateStr;
    const isMid = startDate && endDate && dateStr > startDate && dateStr < endDate;
    const isSelected = isStart || isEnd;

    // Get dominant category color if has expenses
    let dotColor = 'var(--accent-primary)';
    if (hasExpenses && dateExpenses[0]) {
      dotColor = getColorForCategory(dateExpenses[0].category);
    }

    let cellClass = 'calendar-day';
    if (isStart) cellClass += ' range-start selected';
    if (isEnd) cellClass += ' range-end selected';
    if (isMid) cellClass += ' range-mid';
    if (hasExpenses) cellClass += ' has-events';

    cells.push(
      <button
        key={`day-${day}`}
        type="button"
        className={cellClass}
        onClick={() => handleDayClick(dateStr)}
        title={hasExpenses ? `${dateExpenses.length} transaction(s)` : 'No transactions'}
      >
        <span className="day-number">{day}</span>
        {hasExpenses && (
          <span
            className="day-indicator"
            style={{ backgroundColor: isSelected ? '#fff' : dotColor }}
          />
        )}
      </button>
    );
  }

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="section-card calendar-card">
      <h3 className="section-title">
        <CalendarIcon size={18} />
        Expense Calendar
      </h3>

      <div className="calendar-header flex align-center justify-between">
        <button type="button" className="btn-icon" onClick={handlePrevMonth}>
          <ChevronLeft size={16} />
        </button>
        <span className="calendar-month-year">
          {monthNames[month]} {year}
        </span>
        <button type="button" className="btn-icon" onClick={handleNextMonth}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="calendar-grid">
        {daysOfWeek.map((day) => (
          <div key={day} className="calendar-weekday-header">
            {day}
          </div>
        ))}
        {cells}
      </div>

      {startDate && (
        <div className="calendar-selected-info flex align-center justify-between">
          <span className="flex align-center gap-8">
            <Tag size={14} style={{ color: 'var(--accent-primary)' }} />
            {startDate === endDate ? (
              <span>
                Filtering for{' '}
                {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            ) : endDate ? (
              <span>
                Range:{' '}
                {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                -{' '}
                {new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            ) : (
              <span>
                From{' '}
                {new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            )}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '4px' }}
            onClick={() => onSelectRange('', '')}
          >
            Clear Range
          </button>
        </div>
      )}
    </div>
  );
};
