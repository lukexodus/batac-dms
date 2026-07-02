import type { AppDb } from '../../db.js';
import type { QrCodeRow } from './tracking.repository.js';

export class QrCodeService {
  async generateAndStore(
    documentId: string,
    actorId: string,
    db?: AppDb
  ): Promise<QrCodeRow> {
    throw new Error('not implemented');
  }

  async generateCoverSheetPdf(
    documentId: string
  ): Promise<Buffer> {
    throw new Error('not implemented');
  }
}
