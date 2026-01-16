import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

interface ImportResult {
  added: number;
  skipped: number;
  updated: number;
  pinouts: number;
  errors: string[];
}

interface FamilyResult {
  baseMpn: string;
  variantsFound: number;
  imported: number;
  skipped: number;
  errors: string[];
  variants: string[];
}

async function importParts(params: {
  mpns: string[];
  source: string;
  extractPinouts: boolean;
  skipExisting: boolean;
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

async function importFamily(params: {
  baseMpn: string;
  extractPinouts: boolean;
  skipExisting: boolean;
}): Promise<FamilyResult> {
  const response = await fetch('http://localhost:3001/api/ingestion/import-family', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Family import failed: ${response.status}`);
  }

  return response.json();
}

export default function AdminImportPage() {
  const [mode, setMode] = useState<'exact' | 'family'>('exact');
  const [mpnInput, setMpnInput] = useState('');
  const [familyInput, setFamilyInput] = useState('');
  const [source, setSource] = useState<'both' | 'digikey' | 'nexar'>('both');
  const [extractPinouts, setExtractPinouts] = useState(false);
  const [skipExisting, setSkipExisting] = useState(true);

  const exactMutation = useMutation({
    mutationFn: importParts,
  });

  const familyMutation = useMutation({
    mutationFn: importFamily,
  });

  const handleExactSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse MPNs (comma, newline, or space separated)
    const mpns = mpnInput
      .split(/[,\n\s]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (mpns.length === 0) return;

    exactMutation.mutate({ mpns, source, extractPinouts, skipExisting });
  };

  const handleFamilySubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const baseMpn = familyInput.trim();
    if (!baseMpn) return;

    familyMutation.mutate({ baseMpn, extractPinouts, skipExisting });
  };

  return (
    <div className="min-h-screen bg-bg-primary text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Import Components</h1>
        <p className="text-gray-400 mb-8">
          Enter part numbers to fetch from Digi-Key and Nexar APIs
        </p>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setMode('exact')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'exact'
                ? 'bg-accent-primary text-white'
                : 'bg-bg-secondary text-gray-400 hover:text-white'
            }`}
          >
            Exact MPNs
          </button>
          <button
            type="button"
            onClick={() => setMode('family')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'family'
                ? 'bg-accent-primary text-white'
                : 'bg-bg-secondary text-gray-400 hover:text-white'
            }`}
          >
            Part Family
          </button>
        </div>

        {/* Exact MPNs Form */}
        {mode === 'exact' && (
          <form onSubmit={handleExactSubmit} className="space-y-6">
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

            {/* Skip Existing Toggle */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                  className="w-5 h-5 accent-accent-primary"
                />
                <div>
                  <span className="font-medium">Skip Existing Parts</span>
                  <p className="text-xs text-gray-500">
                    Don't re-import parts already in the database
                  </p>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={exactMutation.isPending || !mpnInput.trim()}
              className="w-full bg-accent-primary hover:bg-emerald-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {exactMutation.isPending ? 'Importing...' : 'Import Parts'}
            </button>
          </form>
        )}

        {/* Part Family Form */}
        {mode === 'family' && (
          <form onSubmit={handleFamilySubmit} className="space-y-6">
            {/* Base Part Number Input */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Base Part Number
              </label>
              <input
                type="text"
                value={familyInput}
                onChange={(e) => setFamilyInput(e.target.value)}
                placeholder="AZ1117C"
                className="w-full bg-bg-secondary border border-gray-700 rounded-lg p-3 font-mono text-sm focus:border-accent-primary focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter the base MPN to import all variants (e.g., AZ1117C will import AZ1117C-3.3, AZ1117C-5.0, etc.)
              </p>
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

            {/* Skip Existing Toggle */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                  className="w-5 h-5 accent-accent-primary"
                />
                <div>
                  <span className="font-medium">Skip Existing Parts</span>
                  <p className="text-xs text-gray-500">
                    Don't re-import parts already in the database
                  </p>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={familyMutation.isPending || !familyInput.trim()}
              className="w-full bg-accent-primary hover:bg-emerald-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-lg transition-colors"
            >
              {familyMutation.isPending ? 'Searching & Importing...' : 'Import Part Family'}
            </button>
          </form>
        )}

        {/* Exact Import Results */}
        {mode === 'exact' && exactMutation.isSuccess && (
          <div className="mt-8 bg-bg-secondary border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-accent-primary">
              Import Complete
            </h2>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{exactMutation.data.added}</div>
                <div className="text-sm text-gray-400">Added</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{exactMutation.data.skipped}</div>
                <div className="text-sm text-gray-400">Skipped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{exactMutation.data.updated}</div>
                <div className="text-sm text-gray-400">Updated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{exactMutation.data.pinouts}</div>
                <div className="text-sm text-gray-400">Pinouts</div>
              </div>
            </div>

            {exactMutation.data.errors.length > 0 && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-amber-500 mb-2">
                  Errors ({exactMutation.data.errors.length})
                </h3>
                <ul className="text-sm text-gray-400 space-y-1">
                  {exactMutation.data.errors.map((err, i) => (
                    <li key={i} className="font-mono">- {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Family Import Results */}
        {mode === 'family' && familyMutation.isSuccess && (
          <div className="mt-8 bg-bg-secondary border border-gray-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-accent-primary">
              Family Import Complete
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{familyMutation.data.variantsFound}</div>
                <div className="text-sm text-gray-400">Variants Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{familyMutation.data.imported}</div>
                <div className="text-sm text-gray-400">Imported</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{familyMutation.data.skipped}</div>
                <div className="text-sm text-gray-400">Skipped</div>
              </div>
            </div>

            {/* List of variants */}
            {familyMutation.data.variants.length > 0 && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-gray-300 mb-2">
                  Variants ({familyMutation.data.variants.length})
                </h3>
                <div className="text-xs text-gray-400 font-mono max-h-32 overflow-y-auto">
                  {familyMutation.data.variants.join(', ')}
                </div>
              </div>
            )}

            {familyMutation.data.errors.length > 0 && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                <h3 className="text-sm font-medium text-amber-500 mb-2">
                  Errors ({familyMutation.data.errors.length})
                </h3>
                <ul className="text-sm text-gray-400 space-y-1 max-h-32 overflow-y-auto">
                  {familyMutation.data.errors.map((err, i) => (
                    <li key={i} className="font-mono text-xs">- {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {mode === 'exact' && exactMutation.isError && (
          <div className="mt-8 bg-red-900/20 border border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-400 mb-2">
              Import Failed
            </h2>
            <p className="text-sm text-gray-400">
              {exactMutation.error instanceof Error ? exactMutation.error.message : 'Unknown error'}
            </p>
          </div>
        )}

        {mode === 'family' && familyMutation.isError && (
          <div className="mt-8 bg-red-900/20 border border-red-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-400 mb-2">
              Family Import Failed
            </h2>
            <p className="text-sm text-gray-400">
              {familyMutation.error instanceof Error ? familyMutation.error.message : 'Unknown error'}
            </p>
          </div>
        )}

        {/* Sample Parts Helper */}
        {mode === 'exact' && (
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
        )}

        {mode === 'family' && (
          <div className="mt-8 p-4 bg-bg-secondary/50 rounded-lg border border-gray-800">
            <h3 className="text-sm font-medium mb-2">Sample Part Families to Try:</h3>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setFamilyInput('AZ1117C')}
                className="text-xs text-accent-primary hover:text-accent-secondary font-mono"
              >
                AZ1117C (LDO family)
              </button>
              <button
                type="button"
                onClick={() => setFamilyInput('LM78')}
                className="text-xs text-accent-primary hover:text-accent-secondary font-mono"
              >
                LM78 (linear regulators)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
