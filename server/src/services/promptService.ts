import { supabaseAdmin } from '../db/supabase';

export interface LLMPrompt {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  category: string;
  system_prompt: string;
  user_prompt_template: string;
  model: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
  version: number;
}

// Cache prompts in memory with TTL
const promptCache = new Map<string, { prompt: LLMPrompt; expires: number }>();
const CACHE_TTL = 60000; // 1 minute

export async function getPrompt(name: string): Promise<LLMPrompt | null> {
  // Check cache
  const cached = promptCache.get(name);
  if (cached && cached.expires > Date.now()) {
    return cached.prompt;
  }

  // Fetch from DB
  const { data, error } = await supabaseAdmin
    .from('llm_prompts')
    .select('*')
    .eq('name', name)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    console.error(`[PromptService] Prompt "${name}" not found:`, error?.message);
    return null;
  }

  // Cache it
  promptCache.set(name, { prompt: data, expires: Date.now() + CACHE_TTL });

  return data;
}

export async function getAllPrompts(): Promise<LLMPrompt[]> {
  const { data, error } = await supabaseAdmin
    .from('llm_prompts')
    .select('*')
    .order('category', { ascending: true })
    .order('display_name', { ascending: true });

  if (error) {
    console.error('[PromptService] Failed to fetch prompts:', error.message);
    return [];
  }

  return data || [];
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return rendered;
}

export function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(2, -2)))];
}

export async function logPromptExecution(params: {
  promptName: string;
  promptId?: string;
  inputVariables: Record<string, unknown>;
  renderedPrompt: string;
  responseRaw: string;
  responseParsed: unknown;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  componentMpn?: string;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  // Truncate large fields
  const truncate = (s: string, max: number) =>
    s.length > max ? s.slice(0, max) + '...' : s;

  try {
    await supabaseAdmin.from('llm_prompt_logs').insert({
      prompt_id: params.promptId || null,
      prompt_name: params.promptName,
      input_variables: params.inputVariables,
      rendered_user_prompt: truncate(params.renderedPrompt, 5000),
      response_raw: truncate(params.responseRaw, 10000),
      response_parsed: params.responseParsed,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      total_tokens: params.inputTokens + params.outputTokens,
      latency_ms: params.latencyMs,
      estimated_cost: calculateCost(params.inputTokens, params.outputTokens),
      component_mpn: params.componentMpn || null,
      success: params.success,
      error_message: params.errorMessage || null
    });
  } catch (error) {
    console.error('[PromptService] Failed to log execution:', error);
  }
}

function calculateCost(inputTokens: number, outputTokens: number): number {
  // GPT-4o-mini pricing (as of 2024)
  const inputCost = (inputTokens / 1000) * 0.00015;
  const outputCost = (outputTokens / 1000) * 0.0006;
  return inputCost + outputCost;
}

export function clearPromptCache(): void {
  promptCache.clear();
  console.log('[PromptService] Cache cleared');
}

export function clearPromptFromCache(name: string): void {
  promptCache.delete(name);
}
