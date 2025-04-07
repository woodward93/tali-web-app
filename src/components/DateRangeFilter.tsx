import React, { useState } from 'react';
import { DATE_RANGES } from '../lib/dateRanges';

interface DateRangeFilterProps {
  value: string;
  customRange?: { start: string; end: string };
  onChange: (range: { option: string; customRange?: { start: string; end: string } }) => void;
}

export function DateRangeFilter({ value, customRange, onChange }: DateRangeFilterProps) {
  const [showCustomRange, setShowCustomRange] = useState(value === 'custom');

  const handleOptionChange = (option: string) => {
    if (option === 'custom') {
      setShowCustomRange(true);
      const today = new Date().toISOString().split('T')[0];
      onChange({
        option: 'custom',
        customRange: customRange || {
          start: today,
          end: today
        }
      });
    } else {
      setShowCustomRange(false);
      const dateRange = DATE_RANGES.find(range => range.value === option);
      if (dateRange) {
        const range = dateRange.getRange();
        onChange({
          option,
          customRange: range
        });
      }
    }
  };

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={(e) => handleOptionChange(e.target.value)}
        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
      >
        {DATE_RANGES.map(range => (
          <option key={range.value} value={range.value}>
            {range.label}
          </option>
        ))}
      </select>

      {showCustomRange && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="date"
            value={customRange?.start || ''}
            onChange={(e) => onChange({
              option: 'custom',
              customRange: {
                ...customRange,
                start: e.target.value
              }
            })}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
          <input
            type="date"
            value={customRange?.end || ''}
            onChange={(e) => onChange({
              option: 'custom',
              customRange: {
                ...customRange,
                end: e.target.value
              }
            })}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
          />
        </div>
      )}
    </div>
  );
}