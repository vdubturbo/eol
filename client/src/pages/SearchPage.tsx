import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { GitCompare, X, Search, RefreshCw } from 'lucide-react';
import { SearchBar } from '../components/search/SearchBar';
import { FilterPanel } from '../components/search/FilterPanel';
import { ResultsList } from '../components/search/ResultsList';
import { useSearchComponents, useFilterOptions, useReplacements } from '../hooks/useComponents';
import { StatusBadge } from '../components/common/StatusBadge';
import { PackageBadge } from '../components/common/PackageBadge';
import { MatchScoreBar } from '../components/common/MatchScoreBar';
import { CompatibilityBadge } from '../components/search/CompatibilityIndicator';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import type { SearchFilters, ReplacementResult } from '@shared/types';

type TabMode = 'search' | 'replacement';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tab state
  const [mode, setMode] = useState<TabMode>(
    (searchParams.get('mode') as TabMode) || 'search'
  );

  // Replacement search state
  const [replacementMpn, setReplacementMpn] = useState(searchParams.get('mpn') || '');
  const [submittedMpn, setSubmittedMpn] = useState(searchParams.get('mpn') || '');

  // Parse filters from URL for search mode
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

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('mode', mode);
    
    if (mode === 'search') {
      if (filters.query) params.set('q', filters.query);
      if (filters.package) params.set('package', filters.package);
      if (filters.mounting_style) params.set('mounting', filters.mounting_style);
      if (filters.pin_count) params.set('pins', filters.pin_count.toString());
      if (filters.lifecycle_status?.length)
        params.set('status', filters.lifecycle_status.join(','));
      if (filters.manufacturer_id) params.set('mfr', filters.manufacturer_id);
      if (page > 1) params.set('page', page.toString());
    } else {
      if (submittedMpn) params.set('mpn', submittedMpn);
    }
    
    setSearchParams(params);
  }, [mode, filters, page, submittedMpn, setSearchParams]);

  // Data fetching - search mode
  const { data: searchResult, isLoading: searchLoading } = useSearchComponents(
    mode === 'search' ? filters : {},
    page
  );
  const { data: filterOptions, isLoading: optionsLoading } = useFilterOptions();

  // Data fetching - replacement mode
  const { 
    data: replacements, 
    isLoading: replacementsLoading, 
    error: replacementsError 
  } = useReplacements(mode === 'replacement' ? submittedMpn : '');

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

  const handleReplacementSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedMpn(replacementMpn.trim());
  };

  const handleModeChange = (newMode: TabMode) => {
    setMode(newMode);
    setCompareIds([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Component Search</h1>
        <p className="text-gray-400">
          Search components or find drop-in replacements
        </p>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2 p-1 bg-bg-secondary rounded-lg w-fit">
        <button
          onClick={() => handleModeChange('search')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'search'
              ? 'bg-accent-primary text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Search className="h-4 w-4" />
          Search Database
        </button>
        <button
          onClick={() => handleModeChange('replacement')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            mode === 'replacement'
              ? 'bg-accent-primary text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          Find Replacement
        </button>
      </div>

      {/* Search Mode */}
      {mode === 'search' && (
        <>
          {/* Search bar */}
          <SearchBar
            value={filters.query || ''}
            onChange={(query) => handleFiltersChange({ ...filters, query: query || undefined })}
            placeholder="Search by MPN, description, or manufacturer..."
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
                isLoading={searchLoading}
                compareIds={compareIds}
                onCompare={handleCompare}
              />
            </div>
          </div>
        </>
      )}

      {/* Replacement Mode */}
      {mode === 'replacement' && (
        <>
          {/* Search input */}
          <form onSubmit={handleReplacementSearch} className="max-w-2xl">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Enter the part number you need to replace:
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={replacementMpn}
                onChange={(e) => setReplacementMpn(e.target.value)}
                placeholder="e.g., TPS54331DR"
                className="flex-1 bg-bg-secondary border border-gray-700 rounded-lg px-4 py-3 font-mono text-white placeholder-gray-500 focus:border-accent-primary focus:outline-none"
                autoFocus
              />
              <button
                type="submit"
                disabled={!replacementMpn.trim()}
                className="btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Find Replacements
              </button>
            </div>
          </form>

          {/* Results */}
          {submittedMpn && (
            <div className="mt-8">
              {replacementsLoading ? (
                <LoadingState message={`Searching for replacements for ${submittedMpn}...`} />
              ) : replacementsError ? (
                <EmptyState
                  type="error"
                  title="Part not found"
                  description={`"${submittedMpn}" is not in the database. Import it first to find replacements.`}
                  action={
                    <Link to="/admin/import" className="btn-primary">
                      Import Parts
                    </Link>
                  }
                />
              ) : !replacements || replacements.length === 0 ? (
                <EmptyState
                  type="search"
                  title="No replacements found"
                  description={`No drop-in replacements were found for ${submittedMpn}. This could mean no parts with the same package exist in the database.`}
                  action={
                    <Link to="/admin/import" className="btn-secondary">
                      Import More Parts
                    </Link>
                  }
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-white">
                      {replacements.length} potential replacement{replacements.length !== 1 ? 's' : ''} for{' '}
                      <span className="font-mono text-accent-secondary">{submittedMpn}</span>
                    </h2>
                  </div>
                  
                  {replacements.map((result) => (
                    <ReplacementCard 
                      key={result.component.id} 
                      result={result}
                      onCompare={handleCompare}
                      isComparing={compareIds.includes(result.component.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Help text when no search yet */}
          {!submittedMpn && (
            <div className="mt-8 p-6 bg-bg-secondary/50 rounded-lg border border-gray-800 max-w-2xl">
              <h3 className="text-sm font-medium text-white mb-2">How it works:</h3>
              <ol className="text-sm text-gray-400 space-y-2 list-decimal list-inside">
                <li>Enter the part number of a component you need to replace</li>
                <li>We'll find all parts with the same package footprint</li>
                <li>Each match is scored by pinout compatibility and electrical specs</li>
                <li>Review the differences before selecting a replacement</li>
              </ol>
            </div>
          )}
        </>
      )}

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
              const component = mode === 'search' 
                ? searchResult?.components.find((c) => c.id === id)
                : replacements?.find((r) => r.component.id === id)?.component;
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

// Replacement result card component
function ReplacementCard({ 
  result, 
  onCompare,
  isComparing 
}: { 
  result: ReplacementResult;
  onCompare: (id: string) => void;
  isComparing: boolean;
}) {
  const { component, match_score, pinout_match, specs_match } = result;

  return (
    <div className={`card hover:border-accent-primary/50 transition-colors ${isComparing ? 'border-accent-primary' : ''}`}>
      <div className="flex items-start gap-6">
        {/* Match score */}
        <div className="w-24 flex-shrink-0">
          <MatchScoreBar score={match_score} label="Match" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-3">
            <div>
              <Link
                to={`/component/${component.id}`}
                className="font-mono text-lg font-semibold text-accent-secondary hover:text-accent-primary"
              >
                {component.mpn}
              </Link>
              <p className="text-sm text-gray-400">
                {component.manufacturer?.name || 'Unknown Manufacturer'}
              </p>
            </div>
            <StatusBadge status={component.lifecycle_status} />
          </div>

          {component.description && (
            <p className="text-sm text-gray-400 mb-4 line-clamp-2">
              {component.description}
            </p>
          )}

          <div className="flex items-center gap-4 mb-4">
            <PackageBadge
              packageName={component.package_normalized}
              pinCount={component.pin_count}
              size="sm"
            />
          </div>

          {/* Compatibility details */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
            {/* Pinout match */}
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Pinout Compatibility
              </h4>
              <div className="flex items-center gap-2">
                <span className="font-mono text-white">
                  {pinout_match.matched}/{pinout_match.total} pins match
                </span>
                {pinout_match.differences.length > 0 && (
                  <span className="text-xs text-amber-400">
                    ({pinout_match.differences.length} differences)
                  </span>
                )}
              </div>
            </div>

            {/* Specs match */}
            <div>
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
                Specs Compatibility
              </h4>
              <div className="flex flex-wrap gap-2">
                {specs_match.compatible.map((spec) => (
                  <CompatibilityBadge key={spec} type="compatible" label={spec} />
                ))}
                {specs_match.warnings.map((spec) => (
                  <CompatibilityBadge key={spec} type="warning" label={spec} />
                ))}
                {specs_match.incompatible.map((spec) => (
                  <CompatibilityBadge key={spec} type="incompatible" label={spec} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Link
            to={`/component/${component.id}`}
            className="btn-secondary text-sm"
          >
            View Details
          </Link>
          <button
            onClick={() => onCompare(component.id)}
            className={`btn-ghost text-sm flex items-center gap-1 ${isComparing ? 'text-accent-primary' : ''}`}
          >
            <GitCompare className="h-4 w-4" />
            {isComparing ? 'Selected' : 'Compare'}
          </button>
        </div>
      </div>
    </div>
  );
}
