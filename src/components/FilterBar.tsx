import React from 'react';
import { X } from 'lucide-react';
import { DateRangeFilter } from './DateRangeFilter';
import { DATE_RANGES } from '../lib/dateRanges';

interface FilterOption<T> {
  key: keyof T;
  label: string;
  type: 'select' | 'dateRange';
  options?: { value: string; label: string }[];
}

interface FilterBarProps<T> {
  filters: Partial<T>;
  options: FilterOption<T>[];
  onFilterChange: (key: keyof T, value: any) => void;
  onFilterRemove: (key: keyof T) => void;
  onFiltersClear: () => void;
}

export function FilterBar<T>({
  filters,
  options,
  onFilterChange,
  onFilterRemove,
  onFiltersClear
}: FilterBarProps<T>) {
  const activeFilters = Object.keys(filters).length;

  if (activeFilters === 0 && options.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">Filters</h3>
        {activeFilters > 0 && (
          <button
            onClick={onFiltersClear}
            className="text-sm text-primary-600 hover:text-primary-500"
          >
            Clear all filters
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {options.map(option => (
          <div key={option.key as string}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {option.label}
            </label>
            {option.type === 'select' && option.options && (
              <select
                value={filters[option.key] || ''}
                onChange={(e) => onFilterChange(option.key, e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              >
                <option value="">All</option>
                {option.options.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            {option.type === 'dateRange' && (
              <DateRangeFilter
                value={(filters[option.key] as any)?.option || 'this_month'}
                customRange={(filters[option.key] as any)?.customRange}
                onChange={(range) => onFilterChange(option.key, range)}
              />
            )}
          </div>
        ))}
      </div>

      {activeFilters > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(filters).map(([key, value]) => {
            const option = options.find(opt => opt.key === key);
            if (!option) return null;

            let label = '';
            if (option.type === 'select') {
              const opt = option.options?.find(o => o.value === value);
              label = `${option.label}: ${opt?.label || value}`;
            } else if (option.type === 'dateRange') {
              const range = value as { option: string; customRange: { start: string; end: string } };
              const dateRange = DATE_RANGES.find(r => r.value === range.option);
              if (range.option === 'custom') {
                label = `${option.label}: ${range.customRange.start} to ${range.customRange.end}`;
              } else {
                label = `${option.label}: ${dateRange?.label || 'Custom Range'}`;
              }
            }

            return (
              <div
                key={key}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-gray-100 text-gray-700"
              >
                {label}
                <button
                  onClick={() => onFilterRemove(key as keyof T)}
                  className="p-1 hover:text-gray-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}