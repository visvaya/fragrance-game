
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { generateZodSchemas } from '@whoisarpit/supabase-to-zod';

async function main() {
    const inputPath = resolve(process.cwd(), 'types/supabase.ts');
    const outputPath = resolve(process.cwd(), 'lib/validations/supabase.schema.ts');

    console.log(`Reading input from ${inputPath}`);
    const inputSource = readFileSync(inputPath, 'utf-8');

    console.log('Generating Zod schemas...');
    let schemas = await generateZodSchemas(inputSource, outputPath);

    // Post-process to remove invalid identifiers like "test-table"
    // The generator produces `export const "test-table" = ...` which is invalid TS.
    schemas = schemas.replaceAll(/export const "test-table"[\s\S]*?\}\);\nexport type "test-table"[\s\S]*?;\n\n/g, '');
    schemas = schemas.replaceAll(/export const "test-table"Insert[\s\S]*?\}\);\nexport type "test-table"Insert[\s\S]*?;\n\n/g, '');
    schemas = schemas.replaceAll(/export const "test-table"Update[\s\S]*?\}\);\nexport type "test-table"Update[\s\S]*?;\n\n/g, '');

    // Inject jsonSchema import
    schemas = `import { jsonSchema } from './json.schema';\n` + schemas;

    // Replace z.any() with jsonSchema for specific fields or generally if safe
    // For now, let's target specific known JSONB fields to be safe, or just bulk replace z.any() if we are confident.
    // Given the task, let's replace `snapshot_metadata: z.any()` and `guesses: z.any()` and `metadata: z.any()`
    // Actually, let's try a regex for key-value pairs where value is z.any()
    // Pattern: `key: z.any()` -> `key: jsonSchema`
    schemas = schemas.replaceAll(': z.any()', ': jsonSchema');

    console.log('Writing filtered output to ' + outputPath);
    writeFileSync(outputPath, schemas);

    console.log('Done!');
}

main().catch(console.error);
