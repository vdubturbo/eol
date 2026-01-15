import { useState } from 'react';
import { Play, Plus, X } from 'lucide-react';
import type { IngestionJob, DataSource } from '@shared/types';

interface NewJobFormProps {
  onSubmit: (params: {
    job_type: IngestionJob['job_type'];
    source?: string;
    category?: string;
    part_numbers?: string[];
  }) => void;
  isSubmitting?: boolean;
}

const jobTypes: Array<{ value: IngestionJob['job_type']; label: string; description: string }> = [
  {
    value: 'api_fetch',
    label: 'API Fetch',
    description: 'Fetch component data from external APIs',
  },
  {
    value: 'pdf_extract',
    label: 'PDF Extraction',
    description: 'Extract specs and pinouts from datasheets',
  },
  {
    value: 'enrich',
    label: 'Data Enrichment',
    description: 'Enrich existing components with additional data',
  },
  {
    value: 'full_import',
    label: 'Full Import',
    description: 'Complete import from all available sources',
  },
];

const dataSources: DataSource[] = ['nexar', 'digikey', 'mouser', 'lcsc'];

export function NewJobForm({ onSubmit, isSubmitting }: NewJobFormProps) {
  const [jobType, setJobType] = useState<IngestionJob['job_type']>('api_fetch');
  const [source, setSource] = useState<string>('');
  const [category, setCategory] = useState('');
  const [partNumbers, setPartNumbers] = useState<string[]>([]);
  const [newPartNumber, setNewPartNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      job_type: jobType,
      source: source || undefined,
      category: category || undefined,
      part_numbers: partNumbers.length > 0 ? partNumbers : undefined,
    });
  };

  const addPartNumber = () => {
    if (newPartNumber.trim() && !partNumbers.includes(newPartNumber.trim())) {
      setPartNumbers([...partNumbers, newPartNumber.trim()]);
      setNewPartNumber('');
    }
  };

  const removePartNumber = (pn: string) => {
    setPartNumbers(partNumbers.filter((p) => p !== pn));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Job Type */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Job Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          {jobTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setJobType(type.value)}
              className={`p-4 rounded-lg border text-left transition-colors ${
                jobType === type.value
                  ? 'bg-accent-primary/10 border-accent-primary text-white'
                  : 'bg-bg-tertiary border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              <div className="font-medium">{type.label}</div>
              <div className="text-xs mt-1 opacity-70">{type.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Data Source */}
      {jobType === 'api_fetch' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Data Source
          </label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="select"
          >
            <option value="">Select a source</option>
            {dataSources.map((src) => (
              <option key={src} value={src}>
                {src.charAt(0).toUpperCase() + src.slice(1)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Category */}
      {jobType === 'api_fetch' && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Category/Search Term
          </label>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., buck converter, LDO regulator"
            className="input"
          />
          <p className="text-xs text-gray-500 mt-1">
            Search for components in this category
          </p>
        </div>
      )}

      {/* Part Numbers */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Specific Part Numbers (optional)
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newPartNumber}
            onChange={(e) => setNewPartNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addPartNumber();
              }
            }}
            placeholder="Enter MPN"
            className="input flex-1"
          />
          <button
            type="button"
            onClick={addPartNumber}
            className="btn-secondary"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {partNumbers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {partNumbers.map((pn) => (
              <span
                key={pn}
                className="inline-flex items-center gap-1 px-2 py-1 bg-bg-tertiary rounded font-mono text-sm"
              >
                {pn}
                <button
                  type="button"
                  onClick={() => removePartNumber(pn)}
                  className="text-gray-500 hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>Processing...</>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Create Job
          </>
        )}
      </button>
    </form>
  );
}
