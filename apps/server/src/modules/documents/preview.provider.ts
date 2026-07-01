export interface PreviewProvider {
  /**
   * Render the first page of a document file as a WebP image.
   * s3Key: the object key for the source file in S3/MinIO.
   * mimeType: MIME type of the source file (e.g. 'application/pdf', 'image/tiff').
   * Returns the WebP image as a Buffer.
   */
  renderFirstPage(s3Key: string, mimeType: string): Promise<Buffer>;
}

export class StubPreviewProvider implements PreviewProvider {
  async renderFirstPage(): Promise<Buffer> {
    // 1×1 transparent WebP placeholder (valid minimal WebP header)
    return Buffer.from(
      'UklGRlYAAABXRUJQVlA4IEoAAADQAQCdASoBAAEAAkA4JYgCdAEO/gHOAAD++' +
      'P3f///////z3/f1f/3//////9H/////////v/////////a//////////8A',
      'base64'
    );
  }
}
