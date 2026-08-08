declare module 'scribe.js-ocr' {
  interface OcrWord {
    text: string;
    conf: number;
  }

  interface OcrLine {
    words: OcrWord[];
  }

  interface OcrPage {
    lines: OcrLine[];
  }

  interface SortedInputFiles {
    pdfFiles?: ArrayBuffer[];
    imageFiles?: ArrayBuffer[];
    ocrFiles?: ArrayBuffer[];
    scribeFiles?: ArrayBuffer[];
  }

  interface ScribeDoc {
    readonly ocr: { active: OcrPage[] };
    recognize(options?: {
      langs?: string[];
      ocrPages?: 'all' | 'none' | 'auto' | 'autoShallow' | 'autoDeep';
    }): Promise<OcrPage[]>;
    close(): Promise<void>;
  }

  interface ScribeApi {
    openDocument(files: SortedInputFiles): Promise<ScribeDoc>;
  }

  const scribe: ScribeApi;
  export default scribe;
}
