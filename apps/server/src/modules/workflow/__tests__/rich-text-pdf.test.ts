import { describe, it, expect } from 'vitest';
import { parseRichTextForPdf } from '../rich-text-pdf.util.js';

describe('parseRichTextForPdf', () => {
  it('parses a plain paragraph', () => {
    const html = '<p>This is a plain paragraph.</p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      [{ text: 'This is a plain paragraph.', bold: false, italic: false, strike: false, code: false }]
    ]);
  });

  it('parses a paragraph with a single bold run', () => {
    const html = '<p>This is <strong>bold</strong> text.</p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      [
        { text: 'This is ', bold: false, italic: false, strike: false, code: false },
        { text: 'bold', bold: true, italic: false, strike: false, code: false },
        { text: ' text.', bold: false, italic: false, strike: false, code: false }
      ]
    ]);
  });

  it('parses a paragraph with nested bold+italic', () => {
    const html = '<p>Some <b>bold and <i>italic</i></b> text.</p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      [
        { text: 'Some ', bold: false, italic: false, strike: false, code: false },
        { text: 'bold and ', bold: true, italic: false, strike: false, code: false },
        { text: 'italic', bold: true, italic: true, strike: false, code: false },
        { text: ' text.', bold: false, italic: false, strike: false, code: false }
      ]
    ]);
  });

  it('parses an empty paragraph (<p></p>)', () => {
    const html = '<p></p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      []
    ]);
  });

  it('parses an out-of-scope element as a plain paragraph fallback', () => {
    const html = '<h2>Title <strong>bold ignored</strong></h2>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      [{ text: 'Title bold ignored', bold: false, italic: false, strike: false, code: false }]
    ]);
  });

  it('parses multiple paragraphs mixed with fallback elements', () => {
    const html = '<p>First para</p><h3>Heading</h3><p>Second <code>code</code> para</p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      [{ text: 'First para', bold: false, italic: false, strike: false, code: false }],
      [{ text: 'Heading', bold: false, italic: false, strike: false, code: false }],
      [
        { text: 'Second ', bold: false, italic: false, strike: false, code: false },
        { text: 'code', bold: false, italic: false, strike: false, code: true },
        { text: ' para', bold: false, italic: false, strike: false, code: false }
      ]
    ]);
  });
});
