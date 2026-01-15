import { updateJob, getComponentById, upsertPinouts } from '../db/queries';
import { extractFromUrl, extractPinoutFromText, extractSpecsFromText } from '../services/pdfExtractor';
import { extractPinoutsWithLLM, extractSpecsWithLLM, mapToPinFunction } from '../services/llmExtractor';
import { supabaseAdmin } from '../db/supabase';

interface PDFJobData {
  jobId: string;
  componentId?: string;
  datasheetUrl?: string;
  useLLM?: boolean;
}

export async function processPdfExtract(jobId: string): Promise<void> {
  console.log(`Processing PDF extraction job ${jobId}`);

  try {
    // Get job details
    const { data: job, error: jobError } = await supabaseAdmin
      .from('ingestion_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    const { componentId, datasheetUrl, useLLM } = job.params as PDFJobData;

    // Mark job as processing
    await updateJob(jobId, {
      status: 'processing',
      started_at: new Date().toISOString()
    });

    // Get datasheet URL from component if not provided
    let url = datasheetUrl;
    let targetComponentId = componentId;

    if (!url && componentId) {
      const component = await getComponentById(componentId);
      url = component?.datasheet_url || undefined;
      targetComponentId = component?.id;
    }

    if (!url) {
      throw new Error('No datasheet URL available');
    }

    // Extract text from PDF
    console.log(`Extracting text from ${url}`);
    const pdfData = await extractFromUrl(url);

    let pinouts: Array<{
      pin_number: number;
      pin_name: string;
      pin_function: string;
      confidence: number;
    }> = [];
    let specs: Record<string, unknown> = {};

    if (useLLM) {
      // Use LLM for extraction
      console.log('Using LLM for extraction');
      pinouts = await extractPinoutsWithLLM(pdfData.text);
      specs = await extractSpecsWithLLM(pdfData.text);
    } else {
      // Use regex-based extraction
      console.log('Using regex for extraction');
      const extractedPinouts = extractPinoutFromText(pdfData.text);
      pinouts = extractedPinouts.map(p => ({
        pin_number: p.pin_number,
        pin_name: p.pin_name,
        pin_function: guessPinFunction(p.pin_name, p.description),
        confidence: 0.6
      }));
      specs = extractSpecsFromText(pdfData.text);
    }

    // Store results if we have a target component
    if (targetComponentId && pinouts.length > 0) {
      await upsertPinouts(
        targetComponentId,
        pinouts.map(p => ({
          pin_number: p.pin_number,
          pin_name: p.pin_name,
          pin_function: mapToPinFunction(p.pin_function),
          source: 'pdf',
          confidence: p.confidence
        }))
      );
    }

    // Update component specs if we extracted any
    if (targetComponentId && Object.keys(specs).length > 0) {
      const component = await getComponentById(targetComponentId);
      const mergedSpecs = { ...component?.specs, ...specs };

      await supabaseAdmin
        .from('components')
        .update({ specs: mergedSpecs })
        .eq('id', targetComponentId);
    }

    // Mark job complete
    await updateJob(jobId, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      result: {
        pages_processed: pdfData.pages,
        pinouts_extracted: pinouts.length,
        specs_extracted: Object.keys(specs).length,
        pinouts,
        specs
      }
    });

  } catch (error) {
    console.error(`PDF extraction job ${jobId} failed:`, error);
    await updateJob(jobId, {
      status: 'failed',
      error_message: (error as Error).message,
      completed_at: new Date().toISOString()
    });
  }
}

// Guess pin function from name and description
function guessPinFunction(name: string, description: string): string {
  const upper = name.toUpperCase();
  const descUpper = description.toUpperCase();

  // Check name first
  if (['VIN', 'VCC', 'VBAT', 'PVIN'].includes(upper)) return 'INPUT_VOLTAGE';
  if (['VOUT', 'PVOUT'].includes(upper)) return 'OUTPUT_VOLTAGE';
  if (['GND', 'PGND', 'AGND', 'VSS'].includes(upper)) return 'GROUND';
  if (['EN', 'ENABLE', 'SHDN', 'ON/OFF'].includes(upper)) return 'ENABLE';
  if (['FB', 'VSNS', 'VSENSE', 'VSEN'].includes(upper)) return 'FEEDBACK';
  if (['BOOT', 'BST', 'BOOTSTRAP'].includes(upper)) return 'BOOTSTRAP';
  if (['SW', 'PH', 'LX', 'PHASE'].includes(upper)) return 'SWITCH_NODE';
  if (['COMP', 'VC', 'CMPN'].includes(upper)) return 'COMPENSATION';
  if (['SS', 'SSTART', 'SOFT'].includes(upper)) return 'SOFT_START';
  if (['PG', 'PGOOD', 'POK'].includes(upper)) return 'POWER_GOOD';
  if (['FREQ', 'RT', 'ROSC'].includes(upper)) return 'FREQUENCY';
  if (['SYNC', 'CLK', 'CLOCK'].includes(upper)) return 'SYNC';
  if (['NC', 'N.C.', 'N/C'].includes(upper)) return 'NC';

  // Check description
  if (descUpper.includes('INPUT') && descUpper.includes('VOLT')) return 'INPUT_VOLTAGE';
  if (descUpper.includes('OUTPUT') && descUpper.includes('VOLT')) return 'OUTPUT_VOLTAGE';
  if (descUpper.includes('GROUND') || descUpper.includes('GND')) return 'GROUND';
  if (descUpper.includes('ENABLE') || descUpper.includes('SHUTDOWN')) return 'ENABLE';
  if (descUpper.includes('FEEDBACK')) return 'FEEDBACK';

  return 'OTHER';
}
