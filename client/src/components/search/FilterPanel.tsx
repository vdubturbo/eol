import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { FilterGroup } from './FilterGroup';
import type { SearchFilters, LifecycleStatus, FilterOptions } from '@shared/types';

interface FilterPanelProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  options: FilterOptions;
  isLoading?: boolean;
}

export function FilterPanel({ filters, onChange, options, isLoading }: FilterPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const updateFilter = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const clearAllFilters = () => {
    onChange({ query: filters.query });
  };

  const hasActiveFilters = Boolean(
    filters.package ||
    filters.mounting_style ||
    filters.pin_count ||
    (filters.lifecycle_status && filters.lifecycle_status.length > 0) ||
    filters.manufacturer_id
  );

  const lifecycleOptions: LifecycleStatus[] = ['Active', 'NRND', 'Obsolete', 'Unknown'];
  const pinCountOptions = [3, 4, 5, 6, 8, 10, 14, 16, 20, 24, 28, 32, 44, 48, 64];

  return (
    <div className="bg-bg-secondary rounded-lg border border-gray-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
          Filters
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 text-xs bg-accent-primary/20 text-accent-primary rounded">
              Active
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-500 hover:text-white flex items-center gap-1 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Filter groups */}
      {!isCollapsed && (
        <div className="p-4 space-y-6">
          {/* Package */}
          <FilterGroup label="Package">
            <select
              value={filters.package || ''}
              onChange={(e) => updateFilter('package', e.target.value || undefined)}
              className="select"
              disabled={isLoading}
            >
              <option value="">All packages</option>
              {options.packages.map((pkg) => (
                <option key={pkg} value={pkg}>
                  {pkg}
                </option>
              ))}
            </select>
          </FilterGroup>

          {/* Mounting Style */}
          <FilterGroup label="Mounting Style">
            <div className="flex gap-2">
              {(['SMD', 'THT'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() =>
                    updateFilter(
                      'mounting_style',
                      filters.mounting_style === style ? undefined : style
                    )
                  }
                  className={`flex-1 px-3 py-2 rounded border text-sm font-medium transition-colors ${
                    filters.mounting_style === style
                      ? 'bg-accent-primary/20 border-accent-primary text-accent-primary'
                      : 'bg-bg-tertiary border-gray-600 text-gray-400 hover:text-white hover:border-gray-500'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </FilterGroup>

          {/* Pin Count */}
          <FilterGroup label="Pin Count">
            <select
              value={filters.pin_count || ''}
              onChange={(e) =>
                updateFilter('pin_count', e.target.value ? parseInt(e.target.value) : undefined)
              }
              className="select"
            >
              <option value="">Any</option>
              {pinCountOptions.map((count) => (
                <option key={count} value={count}>
                  {count} pins
                </option>
              ))}
            </select>
          </FilterGroup>

          {/* Lifecycle Status */}
          <FilterGroup label="Lifecycle Status">
            <div className="space-y-2">
              {lifecycleOptions.map((status) => {
                const isChecked = filters.lifecycle_status?.includes(status) || false;
                return (
                  <label
                    key={status}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        const current = filters.lifecycle_status || [];
                        const updated = isChecked
                          ? current.filter((s) => s !== status)
                          : [...current, status];
                        updateFilter('lifecycle_status', updated.length > 0 ? updated : undefined);
                      }}
                      className="h-4 w-4 rounded border-gray-600 bg-bg-tertiary text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
                    />
                    <span
                      className={`text-sm ${
                        isChecked ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'
                      }`}
                    >
                      {status}
                    </span>
                  </label>
                );
              })}
            </div>
          </FilterGroup>

          {/* Manufacturer */}
          <FilterGroup label="Manufacturer">
            <select
              value={filters.manufacturer_id || ''}
              onChange={(e) => updateFilter('manufacturer_id', e.target.value || undefined)}
              className="select"
              disabled={isLoading}
            >
              <option value="">All manufacturers</option>
              {options.manufacturers.map((mfr) => (
                <option key={mfr.id} value={mfr.id}>
                  {mfr.name}
                </option>
              ))}
            </select>
          </FilterGroup>
        </div>
      )}
    </div>
  );
}
