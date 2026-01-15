import { ResultCard } from './ResultCard';
import { EmptyState } from '../common/EmptyState';
import { SkeletonCard } from '../common/LoadingState';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentWithManufacturer } from '@shared/types';

interface ResultsListProps {
  components: ComponentWithManufacturer[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  compareIds?: string[];
  onCompare?: (id: string) => void;
}

export function ResultsList({
  components,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading,
  compareIds = [],
  onCompare,
}: ResultsListProps) {
  const totalPages = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (components.length === 0) {
    return <EmptyState type="search" />;
  }

  return (
    <div>
      {/* Results info */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          Showing <span className="text-white font-medium">{from}</span> -{' '}
          <span className="text-white font-medium">{to}</span> of{' '}
          <span className="text-white font-medium">{total}</span> results
        </p>
      </div>

      {/* Results */}
      <div className="space-y-4 mb-6">
        {components.map((component) => (
          <ResultCard
            key={component.id}
            component={component}
            onCompare={onCompare}
            isComparing={compareIds.includes(component.id)}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="btn-secondary flex items-center gap-1 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`w-10 h-10 rounded-md text-sm font-medium transition-colors ${
                    pageNum === page
                      ? 'bg-accent-primary text-white'
                      : 'text-gray-400 hover:text-white hover:bg-bg-tertiary'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="btn-secondary flex items-center gap-1 disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
