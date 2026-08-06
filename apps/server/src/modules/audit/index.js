import { AuditRepository } from './audit.repository.js';
import { AuditWriteService } from './audit.write-service.js';
import { AuditQueryService } from './audit.query-service.js';
// ─── Factory ───────────────────────────────────────────────────────────────────
export function createAuditModule(deps) {
    const repo = new AuditRepository(deps.auditDb);
    const writeService = new AuditWriteService(repo, deps.env);
    const queryService = new AuditQueryService(repo, deps.env);
    return {
        writeEvent: (e) => writeService.writeEvent(e),
        queryEvents: (f) => queryService.queryEvents(f),
        _internal: {
            repo,
            writeService,
        },
    };
}
export * from './audit.types.js';
