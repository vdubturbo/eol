import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

interface ImportResult {
  added: number;
  updated: number;
  pinouts: number;
  errors: string[];
}

async function importParts(params: {
  mpns: string[];
  source: string;
  extractPinouts: boolean;
}): Promise<ImportResult> {
  const response = await fetch('http://localhost:3001/api/ingestion/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Import failed: ${response.status}`);
  }

  return response.json();
}

export default function AdminImportPage() {
  const [mpnInput, setMpnInput] = useState('');
  const [source, setSource] = useState<'both' | 'digikey' | 'nexar'>('both');
  const [extractPinouts, setExtractPinouts] = useState(false);

  const mutation = useMutation({
    mutationFn: importParts,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse MPNs (comma, newline, or space separated)
    const mpns = mpnInput
      .split(/[,\n\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (mpns.length === 0) return;

    mutation.mutate({ mpns, source, extractPinouts });
  };

  return (
    <div className="min-h-screen bg-bg-primary text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Import Components</h1>
        <p className="text-gray-400 mb-8">
          Enter part numbers to fetch from Digi-Key and Nexar APIs
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Part Numbers Input */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Part Numbers
            </label>
            <textarea
              value={mpnInput}
              onChange={(e) => setMpnInput(e.target.value)}
              placeholder="TPS54331DR&#10;LM2596S-ADJ&#10;MP1584EN-LF-Z"
              rows={6}
              className="w-full bg-bg-secondary border border-gray-700 rounded-lg p-3 font-mono text-sm focus:border-accent-primary focus:outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              One per line, or comma/space separated
            </p>
          </div>

          {/* Source Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Data Source
            </label>
            <div className="flex gap-4">
              {(['both', 'digikey', 'nexar'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="source"
                    value={opt}
                    checked={source === opt}
                    onChange={() => setSource(opt)}
                    className="accent-accent-primary"
                  />
                  <span className="capitalize">{opt === 'both' ? 'Both APIs' : opt}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Extract Pinouts Toggle */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={extractPinouts}
                onChange={(e) => setExtractPinouts(e.target.checked)}
                className="w-5 h-5 accent-accent-primary"
              />
              <div>
                <span className="font-medium">Extract Pinouts from Datasheets</span>
                <p className="text-xs text-gray-500">
                  Uses OpenAI to read PDFs (~$0.003/part)
                </p>
              </div>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={mutation.isPending || !mpnInput.trim()}
            className="w-full bg-accent-primary hover:bg-emerald-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {mutation.isPending ? 'Importing...' : 'Import Parts'}
          </button>
        </form>

        {/* Results */}
        {mutation.isSuccess && (
          <div className="mt-8 bg-bg-secondary border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-accent-primary">
              Import Complete
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{mutation.data.added}</div>
                <div className="text-sm text-gray-400">Added</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{mutation.data.updated}</div>
                <div className="text-sm text-gray-400">Updated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{mutation.data.pinouts}</div>
                <div className="text-sm text-gray-400">Pinouts</div>
              </div>
            </div>

            {mutation.data.errors.length > 0 && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-amber-500 mb-2">
                  Errors ({mutation.data.errors.length})
                </h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  {mutation.data.errors.map((err, i) => (
                    <li key={i} className="font-mono">- {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {mutation.isError && (
          <div className="mt-8 bg-red-900/20 border border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-400 mb-2">
              Import Failed
            </h2>
            <p className="text-sm text-gray-400">
              {mutation.error instanceof Error ? mutation.error.message : 'Unknown error'}
            </p>
          </div>
        )}

        {/* Sample Parts Helper */}
        <div className="mt-8 p-4 bg-bg-secondary/50 rounded-lg border border-gray-800">
          <h3 className="text-sm font-medium mb-2">Sample DC-DC Converters to Try:</h3>
          <button
            type="button"
            onClick={() => setMpnInput('TPS54331DR\nLM2596S-ADJ\nMP1584EN-LF-Z\nLM2675M-5.0\nAP3015KTR-G1')}
            className="text-xs text-accent-primary hover:text-accent-secondary font-mono"
          >
            Click to load sample parts
          </button>
        </div>
      </div>
    </div>
  );
}
