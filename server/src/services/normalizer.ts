// Package normalization utilities

const PACKAGE_ALIASES: Record<string, string[]> = {
  'SOIC-8': ['8-SOIC', 'SO-8', 'SOP-8', 'SOP8', 'SOIC8'],
  'SOIC-14': ['14-SOIC', 'SO-14', 'SOP-14', 'SOP14', 'SOIC14'],
  'SOIC-16': ['16-SOIC', 'SO-16', 'SOP-16', 'SOP16', 'SOIC16'],
  'TSSOP-8': ['8-TSSOP', 'TSSOP8', 'MSOP-8', 'MSOP8'],
  'TSSOP-14': ['14-TSSOP', 'TSSOP14'],
  'TSSOP-16': ['16-TSSOP', 'TSSOP16'],
  'TSSOP-20': ['20-TSSOP', 'TSSOP20'],
  'QFN-8': ['8-QFN', 'DFN-8', '8-DFN', 'QFN8', 'DFN8'],
  'QFN-16': ['16-QFN', 'DFN-16', '16-DFN', 'QFN16', 'DFN16'],
  'QFN-20': ['20-QFN', 'DFN-20', '20-DFN', 'QFN20', 'DFN20'],
  'QFN-24': ['24-QFN', 'DFN-24', '24-DFN', 'QFN24', 'DFN24'],
  'QFN-32': ['32-QFN', 'DFN-32', '32-DFN', 'QFN32', 'DFN32'],
  'SOT-23': ['SOT23', 'SOT-23-3', 'SOT23-3'],
  'SOT-23-5': ['SOT23-5', 'SOT-23-5L', 'TSOT-23-5'],
  'SOT-23-6': ['SOT23-6', 'SOT-23-6L', 'TSOT-23-6'],
  'SOT-223': ['SOT223', 'SOT-223-4'],
  'TO-220': ['TO220', 'TO-220-3', 'TO-220AB'],
  'TO-263': ['TO263', 'D2PAK', 'DDPAK', 'TO-263-5'],
  'TO-252': ['TO252', 'DPAK'],
};

// Reverse lookup map
const REVERSE_ALIASES: Map<string, string> = new Map();
for (const [normalized, aliases] of Object.entries(PACKAGE_ALIASES)) {
  REVERSE_ALIASES.set(normalized.toUpperCase(), normalized);
  for (const alias of aliases) {
    REVERSE_ALIASES.set(alias.toUpperCase(), normalized);
  }
}

export function normalizePackage(raw: string): string {
  if (!raw) return raw;

  // Clean up the input
  const cleaned = raw
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[()]/g, '');

  // Try direct lookup
  const normalized = REVERSE_ALIASES.get(cleaned);
  if (normalized) return normalized;

  // Try to extract package type and pin count
  const match = cleaned.match(/^(SOIC|TSSOP|MSOP|QFN|DFN|SOT|TO)-?(\d+)/i);
  if (match) {
    const type = match[1].toUpperCase();
    const pins = match[2];
    const candidate = `${type}-${pins}`;
    return REVERSE_ALIASES.get(candidate) || candidate;
  }

  // Return cleaned version if no normalization found
  return raw.trim();
}

// Manufacturer name normalization
const MANUFACTURER_ALIASES: Record<string, string[]> = {
  'Texas Instruments': ['TI', 'Texas Inst', 'Texas Instruments Inc'],
  'Analog Devices': ['ADI', 'Analog Devices Inc', 'AD'],
  'ON Semiconductor': ['ON Semi', 'ONSemi', 'Fairchild', 'ON Semiconductor Corp'],
  'STMicroelectronics': ['ST', 'STMicro', 'ST Microelectronics'],
  'Infineon Technologies': ['Infineon', 'IRF', 'International Rectifier'],
  'Microchip Technology': ['Microchip', 'Atmel', 'Microchip Tech'],
  'NXP Semiconductors': ['NXP', 'Freescale', 'Philips Semiconductors'],
  'Maxim Integrated': ['Maxim', 'Maxim IC', 'Dallas Semiconductor'],
  'Monolithic Power Systems': ['MPS', 'Monolithic Power'],
  'ROHM Semiconductor': ['ROHM', 'Rohm'],
  'Diodes Incorporated': ['Diodes Inc', 'Diodes', 'Pericom'],
  'Renesas Electronics': ['Renesas', 'Intersil', 'IDT'],
  'Vishay Intertechnology': ['Vishay', 'Vishay Siliconix'],
  'Nexperia': ['Nexperia B.V.'],
  'Toshiba': ['Toshiba Electronic', 'Toshiba Semiconductor'],
};

const REVERSE_MANUFACTURER: Map<string, string> = new Map();
for (const [normalized, aliases] of Object.entries(MANUFACTURER_ALIASES)) {
  REVERSE_MANUFACTURER.set(normalized.toLowerCase(), normalized);
  for (const alias of aliases) {
    REVERSE_MANUFACTURER.set(alias.toLowerCase(), normalized);
  }
}

export function normalizeManufacturer(raw: string): string {
  if (!raw) return raw;

  const normalized = REVERSE_MANUFACTURER.get(raw.toLowerCase().trim());
  return normalized || raw.trim();
}

// Extract pin count from package name
export function extractPinCount(packageName: string): number | null {
  if (!packageName) return null;

  const match = packageName.match(/(\d+)/);
  if (match) {
    const count = parseInt(match[1]);
    // Sanity check - most packages have 3-100 pins
    if (count >= 3 && count <= 100) {
      return count;
    }
  }

  return null;
}

// Determine mounting style from package
export function getMountingStyle(packageName: string): 'SMD' | 'THT' | null {
  if (!packageName) return null;

  const smdPatterns = /^(SOIC|TSSOP|MSOP|QFN|DFN|SOT|WSON|SON|VQFN|HVQFN|TO-252|TO-263|DPAK|D2PAK)/i;
  const thtPatterns = /^(DIP|PDIP|TO-220|TO-92|TO-3)/i;

  if (smdPatterns.test(packageName)) return 'SMD';
  if (thtPatterns.test(packageName)) return 'THT';

  return null;
}

// Normalize lifecycle status
export function normalizeLifecycle(raw: string): 'Active' | 'NRND' | 'Obsolete' | 'Unknown' {
  if (!raw) return 'Unknown';

  const lower = raw.toLowerCase();

  if (lower.includes('active') || lower.includes('production')) {
    return 'Active';
  }
  if (lower.includes('nrnd') || lower.includes('not recommended') || lower.includes('last time buy')) {
    return 'NRND';
  }
  if (lower.includes('obsolete') || lower.includes('discontinued') || lower.includes('eol')) {
    return 'Obsolete';
  }

  return 'Unknown';
}
