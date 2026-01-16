import { Router } from 'express';
import { getComponentByMpn, findSamePackageComponents } from '../db/queries';
import type { PinFunction, ReplacementResult } from '../types';

const router = Router();

// Find drop-in replacements for a part
router.get('/replacements/:mpn', async (req, res) => {
  try {
    const { mpn } = req.params;
    console.log(`[Search] Looking for replacements for: ${mpn}`);

    // 1. Get the original component
    const original = await getComponentByMpn(mpn);
    console.log(`[Search] Found original:`, original ? original.mpn : 'null');

    if (!original) {
      return res.status(404).json({ message: 'Component not found' });
    }

    if (!original.package_normalized) {
      console.log(`[Search] No package_normalized for ${mpn}`);
      return res.status(400).json({ message: 'Component has no package information' });
    }

    console.log(`[Search] Looking for same package: ${original.package_normalized}`);

    // 2. Find candidates with same package
    const candidates = await findSamePackageComponents(
      original.package_normalized,
      original.id
    );

    console.log(`[Search] Found ${candidates.length} candidates`);

    // 3. Score each candidate
    const results: ReplacementResult[] = candidates.map(candidate => {
      const pinoutScore = calculatePinoutMatch(
        original.pinouts || [],
        candidate.pinouts || []
      );
      const specsScore = calculateSpecsMatch(original.specs, candidate.specs);

      return {
        component: candidate,
        match_score: (pinoutScore.score * 0.6) + (specsScore.score * 0.4),
        pinout_match: pinoutScore,
        specs_match: specsScore
      };
    });

    // 4. Sort by match score
    results.sort((a, b) => b.match_score - a.match_score);

    res.json(results);
  } catch (error) {
    console.error('Replacement search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
});

interface PinoutMatchResult {
  matched: number;
  total: number;
  score: number;
  differences: Array<{
    pin_number: number;
    original_function: PinFunction;
    replacement_function: PinFunction;
    severity: 'compatible' | 'warning' | 'incompatible';
  }>;
}

function calculatePinoutMatch(
  original: Array<{ pin_number: number; pin_function: PinFunction }>,
  candidate: Array<{ pin_number: number; pin_function: PinFunction }>
): PinoutMatchResult {
  if (!original.length || !candidate.length) {
    return { matched: 0, total: original.length, score: 0, differences: [] };
  }

  const differences: PinoutMatchResult['differences'] = [];
  let matched = 0;

  for (const origPin of original) {
    const candPin = candidate.find(p => p.pin_number === origPin.pin_number);
    if (candPin?.pin_function === origPin.pin_function) {
      matched++;
    } else if (candPin) {
      differences.push({
        pin_number: origPin.pin_number,
        original_function: origPin.pin_function,
        replacement_function: candPin.pin_function,
        severity: getSeverity(origPin.pin_function, candPin.pin_function)
      });
    }
  }

  return {
    matched,
    total: original.length,
    score: original.length > 0 ? matched / original.length : 0,
    differences
  };
}

interface SpecsMatchResult {
  compatible: string[];
  incompatible: string[];
  warnings: string[];
  score: number;
}

function calculateSpecsMatch(
  original: Record<string, unknown> | null,
  candidate: Record<string, unknown> | null
): SpecsMatchResult {
  const compatible: string[] = [];
  const incompatible: string[] = [];
  const warnings: string[] = [];

  if (!original || !candidate) {
    return { compatible: [], incompatible: [], warnings: [], score: 0.5 };
  }

  // Check voltage compatibility
  const origVinMax = original.vin_max as number | undefined;
  const candVinMax = candidate.vin_max as number | undefined;
  if (candVinMax !== undefined && origVinMax !== undefined) {
    if (candVinMax >= origVinMax) {
      compatible.push('Input voltage');
    } else {
      incompatible.push(`Vin max: ${candVinMax}V < ${origVinMax}V`);
    }
  }

  // Check current capability
  const origIoutMax = original.iout_max as number | undefined;
  const candIoutMax = candidate.iout_max as number | undefined;
  if (candIoutMax !== undefined && origIoutMax !== undefined) {
    if (candIoutMax >= origIoutMax) {
      compatible.push('Output current');
    } else {
      incompatible.push(`Iout max: ${candIoutMax}A < ${origIoutMax}A`);
    }
  }

  // Check output voltage range
  const origVoutMin = original.vout_min as number | undefined;
  const origVoutMax = original.vout_max as number | undefined;
  const candVoutMin = candidate.vout_min as number | undefined;
  const candVoutMax = candidate.vout_max as number | undefined;

  if (origVoutMin !== undefined && origVoutMax !== undefined &&
      candVoutMin !== undefined && candVoutMax !== undefined) {
    if (candVoutMin <= origVoutMin && candVoutMax >= origVoutMax) {
      compatible.push('Output voltage range');
    } else {
      warnings.push(`Vout range: ${candVoutMin}-${candVoutMax}V vs ${origVoutMin}-${origVoutMax}V`);
    }
  }

  const totalChecks = compatible.length + incompatible.length + warnings.length;
  const score = totalChecks > 0
    ? (compatible.length + warnings.length * 0.5) / totalChecks
    : 0.5;

  return { compatible, incompatible, warnings, score };
}

function getSeverity(
  orig: PinFunction,
  cand: PinFunction
): 'compatible' | 'warning' | 'incompatible' {
  // Critical pins that must match
  const critical: PinFunction[] = ['INPUT_VOLTAGE', 'OUTPUT_VOLTAGE', 'GROUND', 'SWITCH_NODE'];
  if (critical.includes(orig) && orig !== cand) {
    return 'incompatible';
  }
  if (orig === 'NC' || cand === 'NC') {
    return 'warning';
  }
  return 'warning';
}

export default router;
