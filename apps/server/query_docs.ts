import { createDB } from './src/database/db.js';
import { documents } from './src/database/schema.js';

async function main() {
  const db = createDB();
  const docs = await db.select({ id: documents.id, title: documents.title, lifecycleState: documents.lifecycleState, ownedByOfficeId: documents.ownedByOfficeId, typeId: documents.documentTypeId }).from(documents);
  console.log('All documents:', docs);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
