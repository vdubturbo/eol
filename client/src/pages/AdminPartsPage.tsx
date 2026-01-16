import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Search,
  Trash2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckSquare,
  Square,
  MinusSquare,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge } from '../components/common/StatusBadge';
import type { LifecycleStatus } from '@shared/types';

interface PartListItem {
  id: string;
  mpn: string;
  description: string | null;
  package_normalized: string | null;
  pin_count: number | null;
  lifecycle_status: LifecycleStatus;
  data_sources: string[];
  datasheet_url: string | null;
  created_at: string;
  updated_at: string;
  manufacturer: { id: string; name: string } | null;
  has_pinouts: boolean;
  pinout_count: number;
}

interface PartsResponse {
  parts: PartListItem[];
  total: number;
  page: number;
  page_size: number;
}

type SortField = 'mpn' | 'lifecycle_status' | 'package_normalized' | 'pin_count' | 'created_at' | 'updated_at';
type SortOrder = 'asc' | 'desc';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function fetchParts(params: {
  query?: string;
  lifecycle_status?: string[];
  manufacturer_id?: string;
  has_pinouts?: boolean | null;
  sort_by: SortField;
  sort_order: SortOrder;
  page: number;
  page_size: number;
}): Promise<PartsResponse> {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set('query', params.query);
  if (params.lifecycle_status?.length) searchParams.set('lifecycle_status', params.lifecycle_status.join(','));
  if (params.manufacturer_id) searchParams.set('manufacturer_id', params.manufacturer_id);
  if (params.has_pinouts !== null) searchParams.set('has_pinouts', String(params.has_pinouts));
  searchParams.set('sort_by', params.sort_by);
  searchParams.set('sort_order', params.sort_order);
  searchParams.set('page', String(params.page));
  searchParams.set('page_size', String(params.page_size));

  const response = await fetch(`${apiBase}/admin/parts?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch parts');
  return response.json();
}

async function fetchFilterOptions(): Promise<{ manufacturers: { id: string; name: string }[] }> {
  const response = await fetch(`${apiBase}/components/meta/filters`);
  if (!response.ok) throw new Error('Failed to fetch filter options');
  return response.json();
}

async function bulkDeleteParts(ids: string[]): Promise<void> {
  const response = await fetch(`${apiBase}/admin/parts/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) throw new Error('Failed to delete parts');
}

async function reprocessParts(ids: string[], extractPinouts: boolean): Promise<{ jobId: string }> {
  const response = await fetch(`${apiBase}/admin/parts/reprocess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, extractPinouts }),
  });
  if (!response.ok) throw new Error('Failed to reprocess parts');
  return response.json();
}

export default function AdminPartsPage() {
  const queryClient = useQueryClient();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LifecycleStatus[]>([]);
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('');
  const [pinoutFilter, setPinoutFilter] = useState<'all' | 'with' | 'without'>('all');

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const timeoutId = setTimeout(() => {
      setDebouncedQuery(value);
      setPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  // Fetch parts
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'parts', debouncedQuery, statusFilter, manufacturerFilter, pinoutFilter, sortBy, sortOrder, page, pageSize],
    queryFn: () => fetchParts({
      query: debouncedQuery || undefined,
      lifecycle_status: statusFilter.length ? statusFilter : undefined,
      manufacturer_id: manufacturerFilter || undefined,
      has_pinouts: pinoutFilter === 'all' ? null : pinoutFilter === 'with',
      sort_by: sortBy,
      sort_order: sortOrder,
      page,
      page_size: pageSize,
    }),
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['filterOptions'],
    queryFn: fetchFilterOptions,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: bulkDeleteParts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'parts'] });
      setSelectedIds(new Set());
    },
  });

  // Reprocess mutation
  const reprocessMutation = useMutation({
    mutationFn: ({ ids, extractPinouts }: { ids: string[]; extractPinouts: boolean }) =>
      reprocessParts(ids, extractPinouts),
    onSuccess: (result) => {
      alert(`Queued ${selectedIds.size} parts for reprocessing. Job ID: ${result.jobId}`);
      setSelectedIds(new Set());
    },
  });

  // Selection handlers
  const allSelected = data?.parts && data.parts.length > 0 && data.parts.every(p => selectedIds.has(p.id));
  const someSelected = data?.parts && data.parts.some(p => selectedIds.has(p.id));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data?.parts.map(p => p.id) || []));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  // Pagination
  const totalPages = Math.ceil((data?.total || 0) / pageSize);

  // Bulk action handlers
  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} parts? This cannot be undone.`)) return;
    deleteMutation.mutate(Array.from(selectedIds));
  };

  const handleBulkReprocess = (extractPinouts: boolean) => {
    if (selectedIds.size === 0) return;
    reprocessMutation.mutate({ ids: Array.from(selectedIds), extractPinouts });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp className="h-4 w-4 inline ml-1" />
    ) : (
      <ChevronDown className="h-4 w-4 inline ml-1" />
    );
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
          <AlertCircle className="h-5 w-5" />
          <span>Failed to load parts: {error instanceof Error ? error.message : 'Unknown error'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Part Management</h1>
        <p className="text-gray-400 mb-6">
          View, filter, and manage components in the database
        </p>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by MPN or description..."
              className="w-full bg-bg-secondary border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:border-accent-primary focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter.join(',')}
            onChange={(e) => {
              setStatusFilter(e.target.value ? e.target.value.split(',') as LifecycleStatus[] : []);
              setPage(1);
            }}
            className="bg-bg-secondary border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-accent-primary focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="NRND">NRND</option>
            <option value="Obsolete">Obsolete</option>
            <option value="Unknown">Unknown</option>
          </select>

          {/* Manufacturer Filter */}
          <select
            value={manufacturerFilter}
            onChange={(e) => {
              setManufacturerFilter(e.target.value);
              setPage(1);
            }}
            className="bg-bg-secondary border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-accent-primary focus:outline-none max-w-[200px]"
          >
            <option value="">All Manufacturers</option>
            {filterOptions?.manufacturers.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          {/* Pinout Filter */}
          <select
            value={pinoutFilter}
            onChange={(e) => {
              setPinoutFilter(e.target.value as 'all' | 'with' | 'without');
              setPage(1);
            }}
            className="bg-bg-secondary border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:border-accent-primary focus:outline-none"
          >
            <option value="all">All Parts</option>
            <option value="with">With Pinouts</option>
            <option value="without">Without Pinouts</option>
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-accent-primary/10 border border-accent-primary/30 rounded-lg">
            <span className="text-sm text-accent-primary font-medium">
              {selectedIds.size} part{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => handleBulkReprocess(true)}
                disabled={reprocessMutation.isPending}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-blue-900/50 text-blue-400 border border-blue-800 rounded hover:bg-blue-900 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" />
                {reprocessMutation.isPending ? 'Queuing...' : 'Re-extract Pinouts'}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-red-900/50 text-red-400 border border-red-800 rounded hover:bg-red-900 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <LoadingState message="Loading parts..." />
        ) : data?.parts && data.parts.length > 0 ? (
          <div className="bg-bg-secondary border border-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800 bg-bg-tertiary/50">
                    <th className="w-12 px-4 py-3">
                      <button onClick={handleSelectAll} className="text-gray-400 hover:text-white">
                        {allSelected ? (
                          <CheckSquare className="h-5 w-5" />
                        ) : someSelected ? (
                          <MinusSquare className="h-5 w-5" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </th>
                    <th
                      className="text-left px-4 py-3 text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                      onClick={() => handleSort('mpn')}
                    >
                      MPN <SortIcon field="mpn" />
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                      Manufacturer
                    </th>
                    <th
                      className="text-left px-4 py-3 text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                      onClick={() => handleSort('lifecycle_status')}
                    >
                      Status <SortIcon field="lifecycle_status" />
                    </th>
                    <th
                      className="text-left px-4 py-3 text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                      onClick={() => handleSort('package_normalized')}
                    >
                      Package <SortIcon field="package_normalized" />
                    </th>
                    <th
                      className="text-center px-4 py-3 text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                      onClick={() => handleSort('pin_count')}
                    >
                      Pins <SortIcon field="pin_count" />
                    </th>
                    <th className="text-center px-4 py-3 text-sm font-medium text-gray-400">
                      Pinouts
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">
                      Sources
                    </th>
                    <th
                      className="text-left px-4 py-3 text-sm font-medium text-gray-400 cursor-pointer hover:text-white"
                      onClick={() => handleSort('updated_at')}
                    >
                      Updated <SortIcon field="updated_at" />
                    </th>
                    <th className="w-20 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data.parts.map((part) => (
                    <tr
                      key={part.id}
                      className={`hover:bg-bg-tertiary/50 ${selectedIds.has(part.id) ? 'bg-accent-primary/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleSelectOne(part.id)}
                          className="text-gray-400 hover:text-white"
                        >
                          {selectedIds.has(part.id) ? (
                            <CheckSquare className="h-5 w-5 text-accent-primary" />
                          ) : (
                            <Square className="h-5 w-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/component/${part.id}`}
                          className="font-mono text-accent-secondary hover:text-accent-primary font-medium"
                        >
                          {part.mpn}
                        </Link>
                        {part.description && (
                          <div className="text-xs text-gray-500 truncate max-w-[200px]" title={part.description}>
                            {part.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {part.manufacturer?.name || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={part.lifecycle_status} />
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-300">
                        {part.package_normalized || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-300">
                        {part.pin_count || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {part.has_pinouts ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-emerald-900/50 text-emerald-400 rounded">
                            {part.pinout_count}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {part.data_sources?.map(source => (
                            <span
                              key={source}
                              className="inline-block px-1.5 py-0.5 text-xs bg-bg-tertiary text-gray-400 rounded"
                            >
                              {source}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {formatDate(part.updated_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {part.datasheet_url && (
                            <a
                              href={part.datasheet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-500 hover:text-accent-primary"
                              title="View Datasheet"
                            >
                              <FileText className="h-4 w-4" />
                            </a>
                          )}
                          <Link
                            to={`/component/${part.id}`}
                            className="text-gray-500 hover:text-accent-primary"
                            title="View Details"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>
                  Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, data.total)} of {data.total}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-bg-tertiary border border-gray-700 rounded px-2 py-1 text-white"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="text-sm text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No parts found"
            description={debouncedQuery || statusFilter.length || manufacturerFilter || pinoutFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Import some parts to get started'}
          />
        )}
      </div>
    </div>
  );
}
