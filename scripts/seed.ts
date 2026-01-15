import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  console.error('Please set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface SeedManufacturer {
  name: string;
  aliases: string[];
}

interface SeedComponent {
  mpn: string;
  manufacturer: string;
  description: string;
  package_raw: string;
  package_normalized: string;
  mounting_style: 'SMD' | 'THT';
  pin_count: number;
  specs: Record<string, unknown>;
  lifecycle_status: 'Active' | 'NRND' | 'Obsolete' | 'Unknown';
  datasheet_url?: string;
  pinouts?: Array<{
    pin_number: number;
    pin_name: string;
    pin_function: string;
  }>;
}

const manufacturers: SeedManufacturer[] = [
  { name: 'Texas Instruments', aliases: ['TI'] },
  { name: 'Analog Devices', aliases: ['ADI', 'AD'] },
  { name: 'ON Semiconductor', aliases: ['ON Semi', 'ONSemi'] },
  { name: 'STMicroelectronics', aliases: ['ST', 'STMicro'] },
  { name: 'Microchip Technology', aliases: ['Microchip'] },
  { name: 'Monolithic Power Systems', aliases: ['MPS'] },
];

const components: SeedComponent[] = [
  {
    mpn: 'TPS54331DR',
    manufacturer: 'Texas Instruments',
    description: '3A, 28V Input, Step-Down Converter with Eco-mode',
    package_raw: '8-SOIC (0.154", 3.90mm Width)',
    package_normalized: 'SOIC-8',
    mounting_style: 'SMD',
    pin_count: 8,
    specs: {
      vin_min: 3.5,
      vin_max: 28,
      vout_min: 0.8,
      vout_max: 25,
      vout_type: 'Adjustable',
      iout_max: 3,
      switching_freq_min: 285000,
      switching_freq_max: 570000,
      efficiency: 0.92,
      operating_temp_min: -40,
      operating_temp_max: 150,
    },
    lifecycle_status: 'Active',
    datasheet_url: 'https://www.ti.com/lit/ds/symlink/tps54331.pdf',
    pinouts: [
      { pin_number: 1, pin_name: 'BOOT', pin_function: 'BOOTSTRAP' },
      { pin_number: 2, pin_name: 'VIN', pin_function: 'INPUT_VOLTAGE' },
      { pin_number: 3, pin_name: 'EN', pin_function: 'ENABLE' },
      { pin_number: 4, pin_name: 'SS', pin_function: 'SOFT_START' },
      { pin_number: 5, pin_name: 'GND', pin_function: 'GROUND' },
      { pin_number: 6, pin_name: 'VSENSE', pin_function: 'FEEDBACK' },
      { pin_number: 7, pin_name: 'COMP', pin_function: 'COMPENSATION' },
      { pin_number: 8, pin_name: 'PH', pin_function: 'SWITCH_NODE' },
    ],
  },
  {
    mpn: 'TPS54340DDA',
    manufacturer: 'Texas Instruments',
    description: '3.5A, 42V Input, Step-Down DC-DC Converter',
    package_raw: '8-SO PowerPAD',
    package_normalized: 'SOIC-8',
    mounting_style: 'SMD',
    pin_count: 8,
    specs: {
      vin_min: 4.5,
      vin_max: 42,
      vout_min: 0.8,
      vout_max: 36,
      vout_type: 'Adjustable',
      iout_max: 3.5,
      switching_freq_min: 340000,
      switching_freq_max: 340000,
      efficiency: 0.95,
      operating_temp_min: -40,
      operating_temp_max: 150,
    },
    lifecycle_status: 'Active',
    datasheet_url: 'https://www.ti.com/lit/ds/symlink/tps54340.pdf',
    pinouts: [
      { pin_number: 1, pin_name: 'BOOT', pin_function: 'BOOTSTRAP' },
      { pin_number: 2, pin_name: 'VIN', pin_function: 'INPUT_VOLTAGE' },
      { pin_number: 3, pin_name: 'EN', pin_function: 'ENABLE' },
      { pin_number: 4, pin_name: 'RT/CLK', pin_function: 'FREQUENCY' },
      { pin_number: 5, pin_name: 'GND', pin_function: 'GROUND' },
      { pin_number: 6, pin_name: 'VSNS', pin_function: 'FEEDBACK' },
      { pin_number: 7, pin_name: 'COMP', pin_function: 'COMPENSATION' },
      { pin_number: 8, pin_name: 'PH', pin_function: 'SWITCH_NODE' },
    ],
  },
  {
    mpn: 'LM2596S-ADJ',
    manufacturer: 'ON Semiconductor',
    description: '3A, 150kHz, Step-Down Voltage Regulator',
    package_raw: 'TO-263-5',
    package_normalized: 'TO-263',
    mounting_style: 'SMD',
    pin_count: 5,
    specs: {
      vin_min: 4.5,
      vin_max: 40,
      vout_min: 1.2,
      vout_max: 37,
      vout_type: 'Adjustable',
      iout_max: 3,
      switching_freq_min: 150000,
      switching_freq_max: 150000,
      operating_temp_min: -40,
      operating_temp_max: 125,
    },
    lifecycle_status: 'Active',
    pinouts: [
      { pin_number: 1, pin_name: 'VIN', pin_function: 'INPUT_VOLTAGE' },
      { pin_number: 2, pin_name: 'OUTPUT', pin_function: 'SWITCH_NODE' },
      { pin_number: 3, pin_name: 'GND', pin_function: 'GROUND' },
      { pin_number: 4, pin_name: 'FB', pin_function: 'FEEDBACK' },
      { pin_number: 5, pin_name: 'ON/OFF', pin_function: 'ENABLE' },
    ],
  },
  {
    mpn: 'MP2359DJ-LF-Z',
    manufacturer: 'Monolithic Power Systems',
    description: '1.2A, 24V, 1.4MHz, Step-Down Converter',
    package_raw: 'SOT23-6',
    package_normalized: 'SOT-23-6',
    mounting_style: 'SMD',
    pin_count: 6,
    specs: {
      vin_min: 4.5,
      vin_max: 24,
      vout_min: 0.81,
      vout_max: 15,
      vout_type: 'Adjustable',
      iout_max: 1.2,
      switching_freq_min: 1400000,
      switching_freq_max: 1400000,
      efficiency: 0.93,
      operating_temp_min: -40,
      operating_temp_max: 85,
    },
    lifecycle_status: 'Active',
    pinouts: [
      { pin_number: 1, pin_name: 'IN', pin_function: 'INPUT_VOLTAGE' },
      { pin_number: 2, pin_name: 'GND', pin_function: 'GROUND' },
      { pin_number: 3, pin_name: 'FB', pin_function: 'FEEDBACK' },
      { pin_number: 4, pin_name: 'EN', pin_function: 'ENABLE' },
      { pin_number: 5, pin_name: 'BST', pin_function: 'BOOTSTRAP' },
      { pin_number: 6, pin_name: 'SW', pin_function: 'SWITCH_NODE' },
    ],
  },
  {
    mpn: 'ADP2302ARDZ-5.0',
    manufacturer: 'Analog Devices',
    description: '2A, 20V, Step-Down DC-DC Converter, Fixed 5V Output',
    package_raw: 'SOIC-8',
    package_normalized: 'SOIC-8',
    mounting_style: 'SMD',
    pin_count: 8,
    specs: {
      vin_min: 3,
      vin_max: 20,
      vout_min: 5,
      vout_max: 5,
      vout_type: 'Fixed',
      iout_max: 2,
      switching_freq_min: 700000,
      switching_freq_max: 700000,
      efficiency: 0.90,
      operating_temp_min: -40,
      operating_temp_max: 125,
    },
    lifecycle_status: 'Active',
    pinouts: [
      { pin_number: 1, pin_name: 'VIN', pin_function: 'INPUT_VOLTAGE' },
      { pin_number: 2, pin_name: 'VREG', pin_function: 'OTHER' },
      { pin_number: 3, pin_name: 'SW', pin_function: 'SWITCH_NODE' },
      { pin_number: 4, pin_name: 'NC', pin_function: 'NC' },
      { pin_number: 5, pin_name: 'GND', pin_function: 'GROUND' },
      { pin_number: 6, pin_name: 'FB', pin_function: 'FEEDBACK' },
      { pin_number: 7, pin_name: 'EN', pin_function: 'ENABLE' },
      { pin_number: 8, pin_name: 'PGOOD', pin_function: 'POWER_GOOD' },
    ],
  },
  {
    mpn: 'LM5576MH',
    manufacturer: 'Texas Instruments',
    description: '75V, 3A, Step-Down Switching Regulator',
    package_raw: 'HTSSOP-20',
    package_normalized: 'TSSOP-20',
    mounting_style: 'SMD',
    pin_count: 20,
    specs: {
      vin_min: 6,
      vin_max: 75,
      vout_min: 1.225,
      vout_max: 65,
      vout_type: 'Adjustable',
      iout_max: 3,
      switching_freq_min: 50000,
      switching_freq_max: 500000,
      operating_temp_min: -40,
      operating_temp_max: 125,
    },
    lifecycle_status: 'NRND',
  },
  {
    mpn: 'LT1074CT',
    manufacturer: 'Analog Devices',
    description: '5A, 100kHz, Step-Down Switching Regulator',
    package_raw: 'TO-220-5',
    package_normalized: 'TO-220',
    mounting_style: 'THT',
    pin_count: 5,
    specs: {
      vin_min: 8,
      vin_max: 60,
      vout_min: 2.21,
      vout_max: 40,
      vout_type: 'Adjustable',
      iout_max: 5,
      switching_freq_min: 100000,
      switching_freq_max: 100000,
      operating_temp_min: 0,
      operating_temp_max: 125,
    },
    lifecycle_status: 'Obsolete',
  },
];

async function seed() {
  console.log('Starting database seed...\n');

  // Seed manufacturers
  console.log('Seeding manufacturers...');
  const manufacturerMap = new Map<string, string>();

  for (const mfr of manufacturers) {
    const { data, error } = await supabase
      .from('manufacturers')
      .upsert({ name: mfr.name, aliases: mfr.aliases }, { onConflict: 'name' })
      .select()
      .single();

    if (error) {
      console.error(`  Failed to create ${mfr.name}:`, error.message);
    } else {
      console.log(`  Created manufacturer: ${mfr.name}`);
      manufacturerMap.set(mfr.name, data.id);
    }
  }

  // Seed components
  console.log('\nSeeding components...');
  for (const comp of components) {
    const manufacturerId = manufacturerMap.get(comp.manufacturer);

    const { data: componentData, error: componentError } = await supabase
      .from('components')
      .upsert(
        {
          mpn: comp.mpn,
          manufacturer_id: manufacturerId,
          description: comp.description,
          package_raw: comp.package_raw,
          package_normalized: comp.package_normalized,
          mounting_style: comp.mounting_style,
          pin_count: comp.pin_count,
          specs: comp.specs,
          lifecycle_status: comp.lifecycle_status,
          datasheet_url: comp.datasheet_url,
          data_sources: ['manual'],
          confidence_score: 1.0,
        },
        { onConflict: 'mpn,manufacturer_id' }
      )
      .select()
      .single();

    if (componentError) {
      console.error(`  Failed to create ${comp.mpn}:`, componentError.message);
      continue;
    }

    console.log(`  Created component: ${comp.mpn}`);

    // Seed pinouts if provided
    if (comp.pinouts && componentData) {
      const pinoutData = comp.pinouts.map((p) => ({
        component_id: componentData.id,
        pin_number: p.pin_number,
        pin_name: p.pin_name,
        pin_function: p.pin_function,
        source: 'manual',
        confidence: 1.0,
      }));

      const { error: pinoutError } = await supabase
        .from('pinouts')
        .upsert(pinoutData, { onConflict: 'component_id,pin_number' });

      if (pinoutError) {
        console.error(`    Failed to add pinouts for ${comp.mpn}:`, pinoutError.message);
      } else {
        console.log(`    Added ${comp.pinouts.length} pinouts`);
      }
    }
  }

  console.log('\nSeed completed!');
  console.log(`  ${manufacturers.length} manufacturers`);
  console.log(`  ${components.length} components`);
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
