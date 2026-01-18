import { Router } from 'express';
import { supabaseAdmin } from '../db/supabase';
import { clearPromptCache, renderTemplate, extractVariables } from '../services/promptService';

const router = Router();

// Get all prompts
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('llm_prompts')
      .select('*')
      .order('category', { ascending: true })
      .order('display_name', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('List prompts error:', error);
    res.status(500).json({ message: 'Failed to list prompts' });
  }
});

// Get single prompt with version history
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [promptResult, versionsResult] = await Promise.all([
      supabaseAdmin.from('llm_prompts').select('*').eq('id', id).single(),
      supabaseAdmin
        .from('llm_prompt_versions')
        .select('*')
        .eq('prompt_id', id)
        .order('version', { ascending: false })
    ]);

    if (promptResult.error) {
      return res.status(404).json({ message: 'Prompt not found' });
    }

    res.json({
      ...promptResult.data,
      versions: versionsResult.data || []
    });
  } catch (error) {
    console.error('Get prompt error:', error);
    res.status(500).json({ message: 'Failed to get prompt' });
  }
});

// Update prompt (creates version)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      system_prompt,
      user_prompt_template,
      model,
      temperature,
      max_tokens,
      change_notes
    } = req.body;

    // Get current version
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('llm_prompts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !current) {
      return res.status(404).json({ message: 'Prompt not found' });
    }

    // Save current as version
    await supabaseAdmin.from('llm_prompt_versions').insert({
      prompt_id: id,
      version: current.version,
      system_prompt: current.system_prompt,
      user_prompt_template: current.user_prompt_template,
      model: current.model,
      temperature: current.temperature,
      max_tokens: current.max_tokens,
      change_notes
    });

    // Update prompt
    const { data, error } = await supabaseAdmin
      .from('llm_prompts')
      .update({
        system_prompt,
        user_prompt_template,
        model,
        temperature,
        max_tokens,
        version: current.version + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Clear cache
    clearPromptCache();

    res.json(data);
  } catch (error) {
    console.error('Update prompt error:', error);
    res.status(500).json({ message: 'Failed to update prompt' });
  }
});

// Create new prompt
router.post('/', async (req, res) => {
  try {
    const {
      name,
      display_name,
      description,
      category,
      system_prompt,
      user_prompt_template,
      model,
      temperature,
      max_tokens
    } = req.body;

    if (!name || !display_name || !system_prompt || !user_prompt_template) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const { data, error } = await supabaseAdmin
      .from('llm_prompts')
      .insert({
        name,
        display_name,
        description,
        category: category || 'extraction',
        system_prompt,
        user_prompt_template,
        model: model || 'gpt-4o-mini',
        temperature: temperature ?? 0.1,
        max_tokens: max_tokens || 4000
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ message: 'Prompt name already exists' });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('Create prompt error:', error);
    res.status(500).json({ message: 'Failed to create prompt' });
  }
});

// Delete prompt
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('llm_prompts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    clearPromptCache();
    res.json({ success: true });
  } catch (error) {
    console.error('Delete prompt error:', error);
    res.status(500).json({ message: 'Failed to delete prompt' });
  }
});

// Rollback to version
router.post('/:id/rollback/:version', async (req, res) => {
  try {
    const { id, version } = req.params;

    const { data: versionData, error: versionError } = await supabaseAdmin
      .from('llm_prompt_versions')
      .select('*')
      .eq('prompt_id', id)
      .eq('version', parseInt(version))
      .single();

    if (versionError || !versionData) {
      return res.status(404).json({ message: 'Version not found' });
    }

    // Get current for new version number
    const { data: current } = await supabaseAdmin
      .from('llm_prompts')
      .select('version')
      .eq('id', id)
      .single();

    // Update to rolled-back content
    const { data, error } = await supabaseAdmin
      .from('llm_prompts')
      .update({
        system_prompt: versionData.system_prompt,
        user_prompt_template: versionData.user_prompt_template,
        model: versionData.model,
        temperature: versionData.temperature,
        max_tokens: versionData.max_tokens,
        version: (current?.version || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    clearPromptCache();
    res.json(data);
  } catch (error) {
    console.error('Rollback prompt error:', error);
    res.status(500).json({ message: 'Failed to rollback prompt' });
  }
});

// Get prompt execution logs
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const { data, error, count } = await supabaseAdmin
      .from('llm_prompt_logs')
      .select('*', { count: 'exact' })
      .eq('prompt_id', id)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) throw error;

    res.json({ logs: data || [], total: count || 0 });
  } catch (error) {
    console.error('Get prompt logs error:', error);
    res.status(500).json({ message: 'Failed to get logs' });
  }
});

// Get all logs (for overview)
router.get('/logs/all', async (req, res) => {
  try {
    const { limit = '100', offset = '0', success } = req.query;

    let query = supabaseAdmin
      .from('llm_prompt_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (success !== undefined) {
      query = query.eq('success', success === 'true');
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({ logs: data || [], total: count || 0 });
  } catch (error) {
    console.error('Get all logs error:', error);
    res.status(500).json({ message: 'Failed to get logs' });
  }
});

// Test prompt (dry run)
router.post('/test', async (req, res) => {
  try {
    const {
      system_prompt,
      user_prompt_template,
      test_variables
    } = req.body;

    if (!user_prompt_template) {
      return res.status(400).json({ message: 'user_prompt_template is required' });
    }

    // Extract variables from template
    const requiredVariables = extractVariables(user_prompt_template);

    // Render template with test variables
    const rendered = renderTemplate(user_prompt_template, test_variables || {});

    // Check for unrendered variables
    const unrendered = rendered.match(/\{\{(\w+)\}\}/g);
    const missingVariables = unrendered ? unrendered.map(v => v.slice(2, -2)) : [];

    // Estimate tokens (rough approximation: ~4 chars per token)
    const systemTokens = system_prompt ? Math.ceil(system_prompt.length / 4) : 0;
    const userTokens = Math.ceil(rendered.length / 4);

    res.json({
      rendered_prompt: rendered,
      required_variables: requiredVariables,
      missing_variables: missingVariables,
      estimated_tokens: {
        system: systemTokens,
        user: userTokens,
        total: systemTokens + userTokens
      }
    });
  } catch (error) {
    console.error('Test prompt error:', error);
    res.status(500).json({ message: 'Failed to test prompt' });
  }
});

// Get log stats summary
router.get('/stats/summary', async (req, res) => {
  try {
    const { days = '7' } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days as string));

    const { data, error } = await supabaseAdmin
      .from('llm_prompt_logs')
      .select('prompt_name, success, total_tokens, estimated_cost, latency_ms')
      .gte('created_at', since.toISOString());

    if (error) throw error;

    // Aggregate by prompt name
    interface PromptSummary {
      prompt_name: string;
      total_calls: number;
      successful_calls: number;
      failed_calls: number;
      total_tokens: number;
      total_cost: number;
      avg_latency_ms: number;
      latencies: number[];
    }

    const summary = (data || []).reduce((acc, row) => {
      if (!acc[row.prompt_name]) {
        acc[row.prompt_name] = {
          prompt_name: row.prompt_name,
          total_calls: 0,
          successful_calls: 0,
          failed_calls: 0,
          total_tokens: 0,
          total_cost: 0,
          avg_latency_ms: 0,
          latencies: []
        };
      }
      acc[row.prompt_name].total_calls++;
      if (row.success) {
        acc[row.prompt_name].successful_calls++;
      } else {
        acc[row.prompt_name].failed_calls++;
      }
      acc[row.prompt_name].total_tokens += row.total_tokens || 0;
      acc[row.prompt_name].total_cost += row.estimated_cost || 0;
      acc[row.prompt_name].latencies.push(row.latency_ms || 0);
      return acc;
    }, {} as Record<string, PromptSummary>);

    // Calculate averages
    const result = Object.values(summary).map((s) => ({
      prompt_name: s.prompt_name,
      total_calls: s.total_calls,
      successful_calls: s.successful_calls,
      failed_calls: s.failed_calls,
      success_rate: s.total_calls > 0 ? (s.successful_calls / s.total_calls) * 100 : 0,
      total_tokens: s.total_tokens,
      total_cost: s.total_cost,
      avg_latency_ms: s.latencies.length > 0
        ? Math.round(s.latencies.reduce((a: number, b: number) => a + b, 0) / s.latencies.length)
        : 0
    }));

    res.json(result);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to get stats' });
  }
});

export default router;
