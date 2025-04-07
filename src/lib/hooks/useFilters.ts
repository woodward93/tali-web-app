import { useState, useCallback } from 'react';

export interface FilterState<T extends Record<string, any>> {
  page: number;
  perPage: number;
  search: string;
  filters: Partial<T>;
  sortBy?: keyof T;
  sortDirection: 'asc' | 'desc';
}

export interface UseFiltersOptions<T> {
  initialFilters?: Partial<T>;
  initialSort?: keyof T;
  initialSortDirection?: 'asc' | 'desc';
}

export function useFilters<T extends Record<string, any>>(options: UseFiltersOptions<T> = {}) {
  const [state, setState] = useState<FilterState<T>>({
    page: 1,
    perPage: 20,
    search: '',
    filters: options.initialFilters || {},
    sortBy: options.initialSort,
    sortDirection: options.initialSortDirection || 'desc',
  });

  const setPage = useCallback((page: number) => {
    setState(prev => ({ ...prev, page }));
  }, []);

  const setPerPage = useCallback((perPage: number) => {
    setState(prev => ({ ...prev, page: 1, perPage }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setState(prev => ({ ...prev, page: 1, search }));
  }, []);

  const setFilter = useCallback((key: keyof T, value: any) => {
    setState(prev => ({
      ...prev,
      page: 1,
      filters: { ...prev.filters, [key]: value }
    }));
  }, []);

  const removeFilter = useCallback((key: keyof T) => {
    setState(prev => {
      const filters = { ...prev.filters };
      delete filters[key];
      return { ...prev, page: 1, filters };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      page: 1,
      filters: {},
      search: ''
    }));
  }, []);

  const setSort = useCallback((field: keyof T) => {
    setState(prev => ({
      ...prev,
      sortBy: field,
      sortDirection: prev.sortBy === field && prev.sortDirection === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  return {
    state,
    setPage,
    setPerPage,
    setSearch,
    setFilter,
    removeFilter,
    clearFilters,
    setSort
  };
}