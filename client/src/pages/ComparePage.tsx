import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { useCompareComponents, useSearchComponents } from '../hooks/useComponents';
import { CompareTable } from '../components/search/CompareTable';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';

export default function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [compareIds, setCompareIds] = useState<string[]>(
    searchParams.get('ids')?.split(',').filter(Boolean) || []
  );
  const [referenceId, setReferenceId] = useState<string | undefined>(
    compareIds[0]
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync URL
  useEffect(() => {
    if (compareIds.length > 0) {
      setSearchParams({ ids: compareIds.join(',') });
    } else {
      setSearchParams({});
    }
  }, [compareIds, setSearchParams]);

  const { data: components, isLoading } = useCompareComponents(compareIds);
  const { data: searchResults } = useSearchComponents(
    { query: searchQuery },
    1,
    10
  );

  const handleRemove = (id: string) => {
    setCompareIds(compareIds.filter((i) => i !== id));
    if (referenceId === id) {
      setReferenceId(compareIds.find((i) => i !== id));
    }
  };

  const handleAdd = (id: string) => {
    if (!compareIds.includes(id) && compareIds.length < 5) {
      setCompareIds([...compareIds, id]);
    }
    setShowAddModal(false);
    setSearchQuery('');
  };

  if (compareIds.length === 0) {
    return (
      <div className="space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Search
        </Link>

        <EmptyState
          type="data"
          title="No components to compare"
          description="Add components from the search page to compare them side by side."
          action={
            <Link to="/" className="btn-primary">
              Search Components
            </Link>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading components..." />;
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Search
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Compare Components</h1>
          <p className="text-gray-400">
            Side-by-side comparison of {compareIds.length} components
          </p>
        </div>

        {compareIds.length < 5 && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Component
          </button>
        )}
      </div>

      {/* Compare table */}
      {components && components.length > 0 && (
        <div className="card overflow-hidden">
          <CompareTable
            components={components}
            referenceId={referenceId}
            onRemove={handleRemove}
            onSetReference={setReferenceId}
          />
        </div>
      )}

      {/* Add modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary rounded-lg border border-gray-700 w-full max-w-md">
            <div className="p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Add Component</h2>
            </div>
            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by MPN..."
                  className="input pl-10"
                  autoFocus
                />
              </div>

              {searchResults && searchResults.components.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {searchResults.components
                    .filter((c) => !compareIds.includes(c.id))
                    .map((component) => (
                      <button
                        key={component.id}
                        onClick={() => handleAdd(component.id)}
                        className="w-full text-left p-3 rounded bg-bg-tertiary hover:bg-gray-700 transition-colors"
                      >
                        <div className="font-mono text-accent-secondary">
                          {component.mpn}
                        </div>
                        <div className="text-sm text-gray-400">
                          {component.manufacturer?.name}
                        </div>
                      </button>
                    ))}
                </div>
              )}

              {searchQuery && searchResults?.components.length === 0 && (
                <p className="text-gray-500 text-center py-4">No results found</p>
              )}
            </div>
            <div className="p-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery('');
                }}
                className="btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
