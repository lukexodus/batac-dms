import { DocumentsRepository } from './src/modules/documents/documents.repository.js';

const vi = {
  fn: (impl?: any) => {
    const fn: any = function(...args: any[]) {
      if (impl) return impl(...args);
    };
    fn.mockReturnThis = function() { return vi.fn(() => this); };
    fn.mockResolvedValue = function(val: any) { return vi.fn(async () => val); };
    return fn;
  }
};

function makeSelectChain(whereRows: any[], limitRows?: any[]) {
  const chain: any = {
    from: vi.fn(() => chain),
  };
  
  if (limitRows !== undefined) {
    chain.where = vi.fn(() => chain);
    chain.limit = vi.fn(async () => limitRows);
  } else {
    chain.where = vi.fn(async () => whereRows);
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
