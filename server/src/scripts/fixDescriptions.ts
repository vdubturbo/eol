import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDescriptions() {
  console.log('Fetching components...');

  const { data: components, error } = await supabase
    .from('components')
    .select('id, mpn, description');

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log(`Found ${components?.length || 0} components`);

  for (const comp of components || []) {
    if (comp.description && comp.description.startsWith('{')) {
      try {
        const parsed = JSON.parse(comp.description);
        const cleanDesc = parsed.ProductDescription || parsed.DetailedDescription || '';

        const { error: updateError } = await supabase
          .from('components')
          .update({ description: cleanDesc })
          .eq('id', comp.id);

        if (updateError) {
          console.error('Error updating', comp.mpn, updateError);
        } else {
          console.log('Fixed:', comp.mpn);
          console.log('  ->', cleanDesc.substring(0, 60) + (cleanDesc.length > 60 ? '...' : ''));
        }
      } catch (e) {
        console.log('Skipping', comp.mpn, '- not valid JSON');
      }
    } else {
      console.log('OK:', comp.mpn, '- already clean');
    }
  }

  console.log('\nDone!');
}

fixDescriptions();
