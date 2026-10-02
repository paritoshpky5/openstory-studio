import { ModelRegistryService } from '../src/lib/services/model-registry';

async function run() {
  console.log('Seeding models...');
  await ModelRegistryService.seedDefaults();
  console.log('Done.');
}

run();
