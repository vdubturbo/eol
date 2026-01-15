import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  GitCompare,
  ExternalLink,
  Cpu,
  Zap,
} from 'lucide-react';
import { useComponent } from '../hooks/useComponents';
import { StatusBadge } from '../components/common/StatusBadge';
import { PackageBadge } from '../components/common/PackageBadge';
import { PinoutTable } from '../components/common/PinoutTable';
import { SpecsGrid } from '../components/common/SpecsGrid';
import { DataSourceIndicator, ConfidenceIndicator } from '../components/common/DataSourceIndicator';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';

export default function ComponentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: component, isLoading, error } = useComponent(id);

  if (isLoading) {
    return <LoadingState message="Loading component details..." />;
  }

  if (error || !component) {
    return (
      <EmptyState
        type="not-found"
        title="Component not found"
        description="The component you're looking for doesn't exist or has been removed."
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
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold font-mono text-accent-secondary">
              {component.mpn}
            </h1>
            <StatusBadge status={component.lifecycle_status} />
          </div>
          <p className="text-lg text-gray-400">
            {component.manufacturer?.name || 'Unknown Manufacturer'}
          </p>
          {component.description && (
            <p className="text-gray-400 mt-2 max-w-2xl">{component.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/replacements/${encodeURIComponent(component.mpn)}`}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Find Replacements
          </Link>
          <Link
            to={`/compare?ids=${component.id}`}
            className="btn-secondary flex items-center gap-2"
          >
            <GitCompare className="h-4 w-4" />
            Compare
          </Link>
          {component.datasheet_url && (
            <a
              href={component.datasheet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Datasheet
            </a>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {/* Package Info */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-accent-secondary" />
              Package Information
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Package</span>
                <PackageBadge
                  packageName={component.package_normalized}
                  mountingStyle={component.mounting_style}
                />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Pin Count</span>
                <span className="font-mono text-white">
                  {component.pin_count || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Mounting Style</span>
                <span className="font-mono text-white">
                  {component.mounting_style || 'Unknown'}
                </span>
              </div>
              {component.dimensions && (
                <>
                  <div className="flex items-center justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Body Size</span>
                    <span className="font-mono text-white">
                      {component.dimensions.body_length} x {component.dimensions.body_width} mm
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-400">Lead Pitch</span>
                    <span className="font-mono text-white">
                      {component.dimensions.lead_pitch} mm
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Pinout */}
          {component.pinouts && component.pinouts.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-white mb-4">Pinout</h2>
              <PinoutTable pinouts={component.pinouts} />
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Electrical Specs */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Electrical Specifications
            </h2>
            <SpecsGrid specs={component.specs} />
          </div>

          {/* Data Quality */}
          <div className="card">
            <h2 className="text-lg font-semibold text-white mb-4">Data Quality</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Data Sources</span>
                <DataSourceIndicator sources={component.data_sources} showLabels />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-800">
                <span className="text-gray-400">Confidence</span>
                <ConfidenceIndicator score={component.confidence_score} />
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-gray-400">Last Updated</span>
                <span className="text-white">
                  {new Date(component.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
