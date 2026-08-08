import { appRouter } from './src/modules/trpc/trpc.router';
import { db } from './src/database/db';

async function run() {
  const caller = appRouter.createCaller({
    db,
    auth: {
      userId: '2bf58612-1c8d-40ff-b068-fad8960c7729',
      cityId: '00000000-0000-4000-8000-000000000001',
      roles: ['sp_secretary'],
      effectiveOfficeIds: [],
      tier: 'USER'
    },
    req: null as any,
    res: null as any,
    log: console as any,
    container: null as any
  });

  const documentTypes = await caller.documents.documentTypes();
  console.log('--- documents.documentTypes Response ---');
  console.log(JSON.stringify({ result: { data: documentTypes } }, null, 2));

  const measureTypeIds = documentTypes
    .filter((t: any) => ['SP_RESOLUTION', 'SP_ORDINANCE', 'SP_APPROPRIATION_ORDINANCE'].includes(t.code))
    .map((t: any) => t.id);
  
  console.log('\n--- documents.search Request Payload ---');
  const payload = {
    "0": {
      "json": {
        "queryText": "",
        "documentTypeIds": measureTypeIds,
        "limit": 100
      }
    }
  };
  console.log(JSON.stringify(payload, null, 2));

  const searchResult = await caller.documents.search(payload["0"].json);
  console.log('\n--- documents.search Response ---');
  console.log(JSON.stringify([{ result: { data: searchResult } }], null, 2));
}

run().catch(console.error).finally(() => process.exit(0));
