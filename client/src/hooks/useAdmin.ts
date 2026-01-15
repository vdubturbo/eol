import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import type { IngestionJob } from '@shared/types';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: api.getDashboardStats,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useJobs(status?: string) {
  return useQuery({
    queryKey: ['admin', 'jobs', status],
    queryFn: () => api.getJobs(status),
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      job_type: IngestionJob['job_type'];
      source?: string;
      category?: string;
      part_numbers?: string[];
    }) => api.createJob(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.retryJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.cancelJob(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'jobs'] });
    },
  });
}

export function useApiUsage(days = 30) {
  return useQuery({
    queryKey: ['admin', 'apiUsage', days],
    queryFn: () => api.getApiUsage(days),
  });
}

export function useApiUsageSummary(days = 30) {
  return useQuery({
    queryKey: ['admin', 'apiUsageSummary', days],
    queryFn: () => api.getApiUsageSummary(days),
  });
}
