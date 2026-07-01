import { vi } from 'vitest';
import { DocumentsRepository } from './src/modules/documents/documents.repository.js';

function makeSelectChain(whereRows: any[], limitRows?: any[]) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  if (limitRows !== undefined) {
    chain.where.mockReturnThis();
    chain.limit.mockResolvedValue(limitRows);
  } else {
    chain.where.mockResolvedValue(whereRows);
  }
  return chain;
}

const SERIES = {
  id: 'series-uuid-1', cityId: 'city-uuid-1', seriesKey: 'sp_resolution',
  sequencePadding: 2, spOrdinal: '7', prefix: null, delimiter: ' ',
  preliminaryFormat: 'Draft 7SP {YEAR}-{NN}', finalFormat: '7SP {YEAR}-{NN}',
  sequenceNamePrefix: 'ns_sp_resolution',
};

async function run() {
  const trx: any = {
    select: vi.fn(() => makeSelectChain([SERIES]))
  };
  const repo = new DocumentsRepository(trx as any);
  
  try {
    const row = await repo.findNumberSeriesByKey('sp_resolution', 'city-1');
    console.log('SUCCESS:', row);
  } catch (e) {
    console.error('ERROR:', e);
  }
}
run();
