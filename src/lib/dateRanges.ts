import { startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format } from 'date-fns';

export type DateRangeOption = {
  label: string;
  value: string;
  getRange: () => { start: string; end: string };
};

export const DATE_RANGES: DateRangeOption[] = [
  {
    label: 'Today',
    value: 'today',
    getRange: () => ({
      start: format(startOfDay(new Date()), 'yyyy-MM-dd'),
      end: format(endOfDay(new Date()), 'yyyy-MM-dd')
    })
  },
  {
    label: 'This Week',
    value: 'this_week',
    getRange: () => ({
      start: format(startOfWeek(new Date()), 'yyyy-MM-dd'),
      end: format(endOfWeek(new Date()), 'yyyy-MM-dd')
    })
  },
  {
    label: 'This Month',
    value: 'this_month',
    getRange: () => ({
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    })
  },
  {
    label: 'This Quarter',
    value: 'this_quarter',
    getRange: () => ({
      start: format(startOfQuarter(new Date()), 'yyyy-MM-dd'),
      end: format(endOfQuarter(new Date()), 'yyyy-MM-dd')
    })
  },
  {
    label: 'This Year',
    value: 'this_year',
    getRange: () => ({
      start: format(startOfYear(new Date()), 'yyyy-MM-dd'),
      end: format(endOfYear(new Date()), 'yyyy-MM-dd')
    })
  },
  {
    label: 'Last Week',
    value: 'last_week',
    getRange: () => ({
      start: format(startOfWeek(subDays(new Date(), 7)), 'yyyy-MM-dd'),
      end: format(endOfWeek(subDays(new Date(), 7)), 'yyyy-MM-dd')
    })
  },
  {
    label: 'Last Month',
    value: 'last_month',
    getRange: () => ({
      start: format(startOfMonth(subDays(new Date(), 30)), 'yyyy-MM-dd'),
      end: format(endOfMonth(subDays(new Date(), 30)), 'yyyy-MM-dd')
    })
  },
  {
    label: 'Last Quarter',
    value: 'last_quarter',
    getRange: () => ({
      start: format(startOfQuarter(subDays(new Date(), 90)), 'yyyy-MM-dd'),
      end: format(endOfQuarter(subDays(new Date(), 90)), 'yyyy-MM-dd')
    })
  },
  {
    label: 'Last Year',
    value: 'last_year',
    getRange: () => ({
      start: format(startOfYear(subDays(new Date(), 365)), 'yyyy-MM-dd'),
      end: format(endOfYear(subDays(new Date(), 365)), 'yyyy-MM-dd')
    })
  },
  {
    label: 'Custom Range',
    value: 'custom',
    getRange: () => ({
      start: format(new Date(), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd')
    })
  }
];

export const getDateRangeFromOption = (option: string, customRange?: { start: string; end: string }) => {
  if (option === 'custom' && customRange) {
    return {
      start: customRange.start,
      end: customRange.end
    };
  }

  const dateRange = DATE_RANGES.find(range => range.value === option);
  return dateRange ? dateRange.getRange() : null;
};