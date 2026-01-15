import { useQuery } from '@tanstack/react-query';
import * as api from '../services/api';
import type { SearchFilters } from '@shared/types';

export function useSearchComponents(filters: SearchFilters, page: number, pageSize = 25) {
  return useQuery({
    queryKey: ['components', 'search', filters, page, pageSize],
    queryFn: () => api.searchComponents(filters, page, pageSize),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useComponent(id: string | undefined) {
  return useQuery({
    queryKey: ['components', id],
    queryFn: () => api.getComponent(id!),
    enabled: !!id,
  });
}

export function useReplacements(mpn: string | undefined) {
  return useQuery({
    queryKey: ['replacements', mpn],
    queryFn: () => api.findReplacements(mpn!),
    enabled: !!mpn,
  });
}

export function useCompareComponents(ids: string[]) {
  return useQuery({
    queryKey: ['components', 'compare', ids],
    queryFn: () => api.compareComponents(ids),
    enabled: ids.length > 0,
  });
}

export function useFilterOptions() {
  return useQuery({
    queryKey: ['filterOptions'],
    queryFn: api.getFilterOptions,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
