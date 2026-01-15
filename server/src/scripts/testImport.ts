import 'dotenv/config';
import { importPartByMpn, importPartsBatch } from '../services/ingestion';

async function testSingleImport() {
  console.log('\n=== Testing Single Part Import ===\n');

  // Test with a well-known part number
  const testMpn = 'TPS54331DR';

  console.log(`Importing: ${testMpn}`);
  const result = await importPartByMpn(testMpn, {
    extractPinouts: true,
    sources: ['nexar', 'digikey']
  });

  console.log('\nResult:');
  console.log(JSON.stringify(result, null, 2));

  return result;
}

async function testBatchImport() {
  console.log('\n=== Testing Batch Import ===\n');

  const testMpns = [
    'TPS54340DDA',
    'LM2596S-ADJ',
    'MP2359DJ-LF-Z'
  ];

  console.log(`Importing ${testMpns.length} parts: ${testMpns.join(', ')}`);
  const results = await importPartsBatch(testMpns, {
    extractPinouts: true,
    sources: ['nexar']
  });

  console.log('\nResults:');
  for (const result of results) {
    console.log(`  ${result.mpn}: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.dataSources.join(', ')}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }

  const successful = results.filter(r => r.success).length;
  console.log(`\nSummary: ${successful}/${results.length} successful`);

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'single';

  try {
    if (command === 'single') {
      await testSingleImport();
    } else if (command === 'batch') {
      await testBatchImport();
    } else if (command === 'mpn') {
      const mpn = args[1];
      if (!mpn) {
        console.error('Usage: npx tsx src/scripts/testImport.ts mpn <MPN>');
        process.exit(1);
      }
      console.log(`\n=== Importing ${mpn} ===\n`);
      const result = await importPartByMpn(mpn);
      console.log('\nResult:');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('Usage:');
      console.log('  npx tsx src/scripts/testImport.ts single  - Test single import');
      console.log('  npx tsx src/scripts/testImport.ts batch   - Test batch import');
      console.log('  npx tsx src/scripts/testImport.ts mpn <MPN> - Import specific MPN');
    }
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }

  console.log('\n=== Test Complete ===\n');
  process.exit(0);
}

main();
