import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, GitCompare } from 'lucide-react';
import { useReplacements } from '../hooks/useComponents';
import { StatusBadge } from '../components/common/StatusBadge';
import { PackageBadge } from '../components/common/PackageBadge';
import { MatchScoreBar } from '../components/common/MatchScoreBar';
import { CompatibilityBadge } from '../components/search/CompatibilityIndicator';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import type { ReplacementResult } from '@shared/types';

export default function ReplacementsPage() {
  const { mpn } = useParams<{ mpn: string }>();
  const decodedMpn = mpn ? decodeURIComponent(mpn) : '';

  const { data: replacements, isLoading, error } = useReplacements(decodedMpn);

  if (isLoading) {
    return <LoadingState message="Searching for drop-in replacements..." />;
  }

  if (error) {
    return (
      <EmptyState
        type="error"
        title="Search failed"
        description="Unable to find replacements for this component. It may not exist in our database."
        action={
          <Link to="/" className="btn-primary">
            Back to Search
          </Link>
        }
      />
    );
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
      <div>
        <div className="flex items-center gap-3 mb-2">
          <RefreshCw className="h-6 w-6 text-accent-primary" />
          <h1 className="text-2xl font-bold text-white">
            Drop-in Replacements for{' '}
            <span className="font-mono text-accent-secondary">{decodedMpn}</span>
          </h1>
        </div>
        <p className="text-gray-400">
          Components with matching package and compatible specifications
        </p>
      </div>

      {/* Results */}
      {!replacements || replacements.length === 0 ? (
        <EmptyState
          type="search"
          title="No replacements found"
          description="No drop-in replacements were found for this component. Try searching for alternatives with different specifications."
          action={
            <Link to="/" className="btn-primary">
              Search Components
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {replacements.map((result) => (
            <ReplacementCard key={result.component.id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReplacementCard({ result }: { result: ReplacementResult }) {
  const { component, match_score, pinout_match, specs_match } = result;

  return (
    <div className="card hover:border-accent-primary/50 transition-colors">
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
          <Link
            to={`/compare?ids=${component.id}`}
            className="btn-ghost text-sm flex items-center gap-1"
          >
            <GitCompare className="h-4 w-4" />
            Compare
          </Link>
        </div>
      </div>
    </div>
  );
}
