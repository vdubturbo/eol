import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { SkeletonTable } from '../common/LoadingState';
import type { ComponentWithManufacturer } from '@shared/types';

interface DataTableProps {
  components: ComponentWithManufacturer[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function DataTable({
  components,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading,
}: DataTableProps) {
  const totalPages = Math.ceil(total / pageSize);

  if (isLoading) {
    return <SkeletonTable rows={10} />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="table">
          <thead>
            <tr>
              <th>MPN</th>
              <th>Manufacturer</th>
              <th>Package</th>
              <th>Status</th>
              <th>Description</th>
              <th>Data Sources</th>
              <th className="w-16"></th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.id}>
                <td>
                  <Link
                    to={`/component/${component.id}`}
                    className="font-mono text-accent-secondary hover:text-accent-primary"
                  >
                    {component.mpn}
                  </Link>
                </td>
                <td className="text-gray-300">
                  {component.manufacturer?.name || '-'}
                </td>
                <td className="font-mono text-sm">
                  {component.package_normalized || '-'}
                </td>
                <td>
                  <StatusBadge status={component.lifecycle_status} size="sm" />
                </td>
                <td className="max-w-xs">
                  <span className="text-gray-400 text-sm line-clamp-1">
                    {component.description || '-'}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    {component.data_sources.map((source) => (
                      <span
                        key={source}
                        className="px-1.5 py-0.5 bg-bg-tertiary rounded text-xs text-gray-400"
                      >
                        {source}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    {component.datasheet_url && (
                      <a
                        href={component.datasheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-accent-secondary"
                        title="Datasheet"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <Link
                      to={`/component/${component.id}`}
                      className="text-gray-500 hover:text-white"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Showing {(page - 1) * pageSize + 1} -{' '}
          {Math.min(page * pageSize, total)} of {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="btn-ghost px-2 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="btn-ghost px-2 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
