import { useState } from 'react';
import { Search } from 'lucide-react';
import { DataTable } from '../components/admin/DataTable';
import { useSearchComponents } from '../hooks/useComponents';
import type { SearchFilters } from '@shared/types';

export default function AdminDataPage() {
  const [filters, setFilters] = useState<SearchFilters>({});
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: searchResult, isLoading } = useSearchComponents(filters, page, pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Data Browser</h1>
        <p className="text-gray-400">Browse and manage all components in the database</p>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={filters.query || ''}
            onChange={(e) => {
              setFilters({ ...filters, query: e.target.value || undefined });
              setPage(1);
            }}
            placeholder="Search by MPN or description..."
            className="input pl-10"
          />
        </div>
        <select
          value={filters.lifecycle_status?.[0] || ''}
          onChange={(e) => {
            setFilters({
              ...filters,
              lifecycle_status: e.target.value
                ? [e.target.value as 'Active' | 'NRND' | 'Obsolete' | 'Unknown']
                : undefined,
            });
            setPage(1);
          }}
          className="select w-40"
        >
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="NRND">NRND</option>
          <option value="Obsolete">Obsolete</option>
          <option value="Unknown">Unknown</option>
        </select>
      </div>

      {/* Data table */}
      <DataTable
        components={searchResult?.components || []}
        total={searchResult?.total || 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={isLoading}
      />
    </div>
  );
}
