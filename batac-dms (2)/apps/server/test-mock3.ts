import { describe, it, expect, vi } from 'vitest';

// Simulating the vitest vi.fn()
function makeBuilder(resolvedRows: any[]) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: function(resolve: any) { resolve(resolvedRows); }
  };
  return chain;
}

// And we can test this in a vitest file
