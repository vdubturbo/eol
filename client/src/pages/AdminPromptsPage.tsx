import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Save,
  RotateCcw,
  History,
  Play,
  AlertCircle,
  Check,
  Clock,
  Zap,
  DollarSign,
  Hash
} from 'lucide-react';
import type { LLMPrompt, LLMPromptLog, LLMPromptWithVersions } from '@shared/types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchPrompts(): Promise<LLMPrompt[]> {
  const response = await fetch(`${API_BASE}/admin/prompts`);
  if (!response.ok) throw new Error('Failed to fetch prompts');
  return response.json();
}

async function fetchPromptWithVersions(id: string): Promise<LLMPromptWithVersions> {
  const response = await fetch(`${API_BASE}/admin/prompts/${id}`);
  if (!response.ok) throw new Error('Failed to fetch prompt');
  return response.json();
}

async function fetchPromptLogs(id: string): Promise<{ logs: LLMPromptLog[]; total: number }> {
  const response = await fetch(`${API_BASE}/admin/prompts/${id}/logs?limit=20`);
  if (!response.ok) throw new Error('Failed to fetch logs');
  return response.json();
}

async function updatePrompt(id: string, data: Partial<LLMPrompt> & { change_notes?: string }): Promise<LLMPrompt> {
  const response = await fetch(`${API_BASE}/admin/prompts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to update prompt');
  return response.json();
}

async function rollbackPrompt(id: string, version: number): Promise<LLMPrompt> {
  const response = await fetch(`${API_BASE}/admin/prompts/${id}/rollback/${version}`, {
    method: 'POST'
  });
  if (!response.ok) throw new Error('Failed to rollback');
  return response.json();
}

async function testPrompt(data: {
  system_prompt: string;
  user_prompt_template: string;
  test_variables: Record<string, string>;
}): Promise<{ rendered_prompt: string; required_variables: string[]; missing_variables: string[]; estimated_tokens: { system: number; user: number; total: number } }> {
  const response = await fetch(`${API_BASE}/admin/prompts/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to test prompt');
  return response.json();
}

export default function AdminPromptsPage() {
  const queryClient = useQueryClient();
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<Partial<LLMPrompt> | null>(null);
  const [changeNotes, setChangeNotes] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ rendered_prompt: string; estimated_tokens: { total: number } } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch all prompts
  const { data: prompts, isLoading: loadingPrompts } = useQuery({
    queryKey: ['prompts'],
    queryFn: fetchPrompts
  });

  // Fetch selected prompt with versions
  const { data: selectedPrompt, isLoading: loadingSelected } = useQuery({
    queryKey: ['prompt', selectedPromptId],
    queryFn: () => fetchPromptWithVersions(selectedPromptId!),
    enabled: !!selectedPromptId
  });

  // Fetch logs for selected prompt
  const { data: logsData } = useQuery({
    queryKey: ['prompt-logs', selectedPromptId],
    queryFn: () => fetchPromptLogs(selectedPromptId!),
    enabled: !!selectedPromptId && showLogs
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LLMPrompt> & { change_notes?: string } }) =>
      updatePrompt(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt', selectedPromptId] });
      setSaveSuccess(true);
      setChangeNotes('');
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => rollbackPrompt(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      queryClient.invalidateQueries({ queryKey: ['prompt', selectedPromptId] });
    }
  });

  // Initialize edited prompt when selected prompt changes
  useEffect(() => {
    if (selectedPrompt) {
      setEditedPrompt({
        system_prompt: selectedPrompt.system_prompt,
        user_prompt_template: selectedPrompt.user_prompt_template,
        model: selectedPrompt.model,
        temperature: selectedPrompt.temperature,
        max_tokens: selectedPrompt.max_tokens
      });
      // Extract variables for test form
      const vars = selectedPrompt.user_prompt_template.match(/\{\{(\w+)\}\}/g);
      if (vars) {
        const varNames = vars.map(v => v.slice(2, -2));
        const initialVars: Record<string, string> = {};
        varNames.forEach(v => {
          initialVars[v] = testVariables[v] || (v === 'datasheet_text' ? 'Sample datasheet content...' : `test_${v}`);
        });
        setTestVariables(initialVars);
      }
    }
  }, [selectedPrompt]);

  // Group prompts by category
  const groupedPrompts = prompts?.reduce((acc, prompt) => {
    if (!acc[prompt.category]) acc[prompt.category] = [];
    acc[prompt.category].push(prompt);
    return acc;
  }, {} as Record<string, LLMPrompt[]>) || {};

  const handleSave = () => {
    if (!selectedPromptId || !editedPrompt) return;
    updateMutation.mutate({
      id: selectedPromptId,
      data: { ...editedPrompt, change_notes: changeNotes }
    });
  };

  const handleTest = async () => {
    if (!editedPrompt) return;
    try {
      const result = await testPrompt({
        system_prompt: editedPrompt.system_prompt || '',
        user_prompt_template: editedPrompt.user_prompt_template || '',
        test_variables: testVariables
      });
      setTestResult(result);
    } catch (err) {
      console.error('Test failed:', err);
    }
  };

  const hasChanges = selectedPrompt && editedPrompt && (
    editedPrompt.system_prompt !== selectedPrompt.system_prompt ||
    editedPrompt.user_prompt_template !== selectedPrompt.user_prompt_template ||
    editedPrompt.model !== selectedPrompt.model ||
    editedPrompt.temperature !== selectedPrompt.temperature ||
    editedPrompt.max_tokens !== selectedPrompt.max_tokens
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">LLM Prompts</h1>
          <p className="text-gray-400 text-sm mt-1">Manage extraction prompts and view execution logs</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Prompt List */}
        <div className="col-span-3 bg-bg-secondary border border-gray-800 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Prompts</h2>

          {loadingPrompts ? (
            <div className="text-gray-500 text-sm">Loading...</div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedPrompts).map(([category, categoryPrompts]) => (
                <div key={category}>
                  <div className="text-xs font-medium text-gray-500 uppercase mb-2">{category}</div>
                  <div className="space-y-1">
                    {categoryPrompts.map(prompt => (
                      <button
                        key={prompt.id}
                        onClick={() => {
                          setSelectedPromptId(prompt.id);
                          setShowHistory(false);
                          setShowLogs(false);
                          setTestResult(null);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${
                          selectedPromptId === prompt.id
                            ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                            : 'text-gray-300 hover:bg-bg-tertiary'
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{prompt.display_name}</span>
                        <span className="ml-auto text-xs text-gray-500">v{prompt.version}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="col-span-9">
          {!selectedPromptId ? (
            <div className="bg-bg-secondary border border-gray-800 rounded-lg p-8 text-center">
              <MessageSquare className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Select a prompt to edit</p>
            </div>
          ) : loadingSelected ? (
            <div className="bg-bg-secondary border border-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">Loading...</p>
            </div>
          ) : selectedPrompt && editedPrompt ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-bg-secondary border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{selectedPrompt.display_name}</h2>
                    <p className="text-sm text-gray-400">{selectedPrompt.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-bg-tertiary text-gray-400 px-2 py-1 rounded">
                      v{selectedPrompt.version}
                    </span>
                    <button
                      onClick={() => setShowHistory(!showHistory)}
                      className={`p-2 rounded-md transition-colors ${
                        showHistory ? 'bg-accent-primary/20 text-accent-primary' : 'text-gray-400 hover:bg-bg-tertiary'
                      }`}
                      title="Version History"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className={`p-2 rounded-md transition-colors ${
                        showLogs ? 'bg-accent-primary/20 text-accent-primary' : 'text-gray-400 hover:bg-bg-tertiary'
                      }`}
                      title="Execution Logs"
                    >
                      <Clock className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Version History Panel */}
              {showHistory && selectedPrompt.versions.length > 0 && (
                <div className="bg-bg-secondary border border-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-white mb-3">Version History</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedPrompt.versions.map(version => (
                      <div
                        key={version.id}
                        className="flex items-center justify-between p-2 bg-bg-tertiary rounded-md"
                      >
                        <div>
                          <span className="text-sm text-white">Version {version.version}</span>
                          <span className="text-xs text-gray-500 ml-2">
                            {new Date(version.created_at).toLocaleDateString()}
                          </span>
                          {version.change_notes && (
                            <p className="text-xs text-gray-400 mt-1">{version.change_notes}</p>
                          )}
                        </div>
                        <button
                          onClick={() => rollbackMutation.mutate({ id: selectedPrompt.id, version: version.version })}
                          disabled={rollbackMutation.isPending}
                          className="text-xs text-accent-primary hover:text-emerald-400 flex items-center gap-1"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Rollback
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Logs Panel */}
              {showLogs && logsData && (
                <div className="bg-bg-secondary border border-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-white mb-3">Recent Executions ({logsData.total} total)</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {logsData.logs.length === 0 ? (
                      <p className="text-sm text-gray-500">No logs yet</p>
                    ) : (
                      logsData.logs.map(log => (
                        <div
                          key={log.id}
                          className={`p-3 rounded-md border ${
                            log.success
                              ? 'bg-emerald-900/10 border-emerald-800/30'
                              : 'bg-red-900/10 border-red-800/30'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {log.success ? (
                                <Check className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-red-400" />
                              )}
                              <span className="text-sm text-white">{log.component_mpn || 'Unknown'}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              {log.total_tokens} tokens
                            </span>
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {log.latency_ms}ms
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              ${log.estimated_cost.toFixed(4)}
                            </span>
                          </div>
                          {!log.success && log.error_message && (
                            <p className="text-xs text-red-400 mt-2">{log.error_message}</p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* System Prompt */}
              <div className="bg-bg-secondary border border-gray-800 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">System Prompt</label>
                <textarea
                  value={editedPrompt.system_prompt || ''}
                  onChange={e => setEditedPrompt({ ...editedPrompt, system_prompt: e.target.value })}
                  rows={4}
                  className="w-full bg-bg-primary border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:border-accent-primary focus:outline-none resize-y"
                />
              </div>

              {/* User Prompt Template */}
              <div className="bg-bg-secondary border border-gray-800 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  User Prompt Template
                  <span className="text-gray-500 font-normal ml-2">
                    (use {'{{variable}}'} for placeholders)
                  </span>
                </label>
                <textarea
                  value={editedPrompt.user_prompt_template || ''}
                  onChange={e => setEditedPrompt({ ...editedPrompt, user_prompt_template: e.target.value })}
                  rows={12}
                  className="w-full bg-bg-primary border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:border-accent-primary focus:outline-none resize-y"
                />

                {/* Variables indicator */}
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.keys(testVariables).map(varName => (
                    <span
                      key={varName}
                      className="text-xs bg-cyan-900/30 text-cyan-400 px-2 py-1 rounded border border-cyan-800/50"
                    >
                      {`{{${varName}}}`}
                    </span>
                  ))}
                </div>
              </div>

              {/* Configuration */}
              <div className="bg-bg-secondary border border-gray-800 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
                    <select
                      value={editedPrompt.model || 'gpt-4o-mini'}
                      onChange={e => setEditedPrompt({ ...editedPrompt, model: e.target.value })}
                      className="w-full bg-bg-primary border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-accent-primary focus:outline-none"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4-turbo">gpt-4-turbo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={editedPrompt.temperature ?? 0.1}
                      onChange={e => setEditedPrompt({ ...editedPrompt, temperature: parseFloat(e.target.value) })}
                      className="w-full bg-bg-primary border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-accent-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Max Tokens</label>
                    <input
                      type="number"
                      step="100"
                      min="100"
                      max="16000"
                      value={editedPrompt.max_tokens || 4000}
                      onChange={e => setEditedPrompt({ ...editedPrompt, max_tokens: parseInt(e.target.value) })}
                      className="w-full bg-bg-primary border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-accent-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Test Section */}
              <div className="bg-bg-secondary border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-white">Test Variables</h3>
                  <button
                    onClick={handleTest}
                    className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm rounded-md transition-colors"
                  >
                    <Play className="h-4 w-4" />
                    Test
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(testVariables).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-xs text-gray-400 mb-1">{key}</label>
                      <input
                        type="text"
                        value={value}
                        onChange={e => setTestVariables({ ...testVariables, [key]: e.target.value })}
                        className="w-full bg-bg-primary border border-gray-700 rounded px-3 py-1.5 text-sm text-white focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                {testResult && (
                  <div className="mt-4 p-3 bg-bg-tertiary rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Rendered Preview</span>
                      <span className="text-xs text-gray-500">~{testResult.estimated_tokens.total} tokens</span>
                    </div>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {testResult.rendered_prompt.slice(0, 1000)}
                      {testResult.rendered_prompt.length > 1000 && '...'}
                    </pre>
                  </div>
                )}
              </div>

              {/* Save */}
              <div className="bg-bg-secondary border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <input
                    type="text"
                    placeholder="Change notes (optional)"
                    value={changeNotes}
                    onChange={e => setChangeNotes(e.target.value)}
                    className="flex-1 bg-bg-primary border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:border-accent-primary focus:outline-none"
                  />
                  <button
                    onClick={handleSave}
                    disabled={!hasChanges || updateMutation.isPending}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      hasChanges
                        ? 'bg-accent-primary hover:bg-emerald-600 text-white'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {saveSuccess ? (
                      <>
                        <Check className="h-4 w-4" />
                        Saved!
                      </>
                    ) : updateMutation.isPending ? (
                      'Saving...'
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
                {hasChanges && (
                  <p className="text-xs text-amber-400 mt-2">You have unsaved changes</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
