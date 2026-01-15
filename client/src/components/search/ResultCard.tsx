import { Link } from 'react-router-dom';
import { ArrowRight, GitCompare, RefreshCw } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { PackageBadge } from '../common/PackageBadge';
import type { ComponentWithManufacturer } from '@shared/types';

interface ResultCardProps {
  component: ComponentWithManufacturer;
  onCompare?: (id: string) => void;
  isComparing?: boolean;
}

export function ResultCard({ component, onCompare, isComparing }: ResultCardProps) {
  return (
    <div className="card-hover group">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/component/${component.id}`}
            className="block"
          >
            <h3 className="font-mono text-lg font-semibold text-accent-secondary group-hover:text-accent-primary transition-colors truncate">
              {component.mpn}
            </h3>
            <p className="text-sm text-gray-400">
              {component.manufacturer?.name || 'Unknown Manufacturer'}
            </p>
          </Link>
        </div>
        <StatusBadge status={component.lifecycle_status} size="sm" />
      </div>

      {component.description && (
        <p className="text-sm text-gray-400 line-clamp-2 mb-4">
          {component.description}
        </p>
      )}

      <div className="flex items-center justify-between">
        <PackageBadge
          packageName={component.package_normalized}
          pinCount={component.pin_count}
          mountingStyle={component.mounting_style}
          size="sm"
        />

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link
            to={`/replacements/${encodeURIComponent(component.mpn)}`}
            className="btn-ghost text-xs flex items-center gap-1"
            title="Find replacements"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Replacements
          </Link>
          {onCompare && (
            <button
              onClick={() => onCompare(component.id)}
              className={`btn-ghost text-xs flex items-center gap-1 ${
                isComparing ? 'text-accent-primary' : ''
              }`}
              title="Add to compare"
            >
              <GitCompare className="h-3.5 w-3.5" />
              Compare
            </button>
          )}
          <Link
            to={`/component/${component.id}`}
            className="btn-ghost text-xs flex items-center gap-1"
          >
            Details
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
