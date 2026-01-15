import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { GitCompare, X } from 'lucide-react';
import { SearchBar } from '../components/search/SearchBar';
import { FilterPanel } from '../components/search/FilterPanel';
import { ResultsList } from '../components/search/ResultsList';
import { useSearchComponents, useFilterOptions } from '../hooks/useComponents';
import type { SearchFilters } from '@shared/types';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Parse filters from URL
  const getFiltersFromParams = (): SearchFilters => ({
    query: searchParams.get('q') || undefined,
    package: searchParams.get('package') || undefined,
    mounting_style: (searchParams.get('mounting') as 'SMD' | 'THT') || undefined,
    pin_count: searchParams.get('pins') ? parseInt(searchParams.get('pins')!) : undefined,
    lifecycle_status: searchParams.get('status')?.split(',') as SearchFilters['lifecycle_status'],
    manufacturer_id: searchParams.get('mfr') || undefined,
  });

  const [filters, setFilters] = useState<SearchFilters>(getFiltersFromParams());
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.query) params.set('q', filters.query);
    if (filters.package) params.set('package', filters.package);
    if (filters.mounting_style) params.set('mounting', filters.mounting_style);
    if (filters.pin_count) params.set('pins', filters.pin_count.toString());
    if (filters.lifecycle_status?.length)
      params.set('status', filters.lifecycle_status.join(','));
    if (filters.manufacturer_id) params.set('mfr', filters.manufacturer_id);
    if (page > 1) params.set('page', page.toString());
    setSearchParams(params);
  }, [filters, page, setSearchParams]);

  // Data fetching
  const { data: searchResult, isLoading } = useSearchComponents(filters, page);
  const { data: filterOptions, isLoading: optionsLoading } = useFilterOptions();

  const handleFiltersChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleCompare = (id: string) => {
    if (compareIds.includes(id)) {
      setCompareIds(compareIds.filter((i) => i !== id));
    } else if (compareIds.length < 4) {
      setCompareIds([...compareIds, id]);
    }
  };

  const goToCompare = () => {
    if (compareIds.length >= 2) {
      navigate(`/compare?ids=${compareIds.join(',')}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Component Search</h1>
        <p className="text-gray-400">
          Find drop-in replacements for electronic components
        </p>
      </div>

      {/* Search bar */}
      <SearchBar
        value={filters.query || ''}
        onChange={(query) => handleFiltersChange({ ...filters, query: query || undefined })}
        autoFocus
      />

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters sidebar */}
        <div className="lg:col-span-1">
          <FilterPanel
            filters={filters}
            onChange={handleFiltersChange}
            options={filterOptions || { packages: [], manufacturers: [] }}
            isLoading={optionsLoading}
          />
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          <ResultsList
            components={searchResult?.components || []}
            total={searchResult?.total || 0}
            page={page}
            pageSize={searchResult?.page_size || 25}
            onPageChange={setPage}
            isLoading={isLoading}
            compareIds={compareIds}
            onCompare={handleCompare}
          />
        </div>
      </div>

      {/* Compare floating bar */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-bg-secondary border border-gray-700 rounded-lg shadow-lg px-6 py-4 flex items-center gap-4 z-40">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-accent-primary" />
            <span className="text-white font-medium">
              {compareIds.length} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            {compareIds.map((id) => {
              const component = searchResult?.components.find((c) => c.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-bg-tertiary rounded font-mono text-sm text-accent-secondary"
                >
                  {component?.mpn || id.slice(0, 8)}
                  <button
                    onClick={() => handleCompare(id)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
          <button
            onClick={goToCompare}
            disabled={compareIds.length < 2}
            className="btn-primary disabled:opacity-50"
          >
            Compare
          </button>
        </div>
      )}
    </div>
  );
}
