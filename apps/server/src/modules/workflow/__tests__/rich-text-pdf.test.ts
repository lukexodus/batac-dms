import { describe, it, expect } from 'vitest';
import { parseRichTextForPdf } from '../rich-text-pdf.util.js';

describe('parseRichTextForPdf', () => {
  it('parses basic paragraph without marks', () => {
    const html = '<p>Hello world</p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      { type: 'paragraph', runs: [{ text: 'Hello world', bold: false, italic: false, strike: false, code: false }] }
    ]);
  });

  it('parses bold, italic, strike, and code marks correctly', () => {
    const html = '<p><strong>bold</strong> <em>italic</em> <s>strike</s> <code>code</code></p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      { type: 'paragraph', runs: [
        { text: 'bold', bold: true, italic: false, strike: false, code: false },
        { text: ' ', bold: false, italic: false, strike: false, code: false },
        { text: 'italic', bold: false, italic: true, strike: false, code: false },
        { text: ' ', bold: false, italic: false, strike: false, code: false },
        { text: 'strike', bold: false, italic: false, strike: true, code: false },
        { text: ' ', bold: false, italic: false, strike: false, code: false },
        { text: 'code', bold: false, italic: false, strike: false, code: true }
      ]}
    ]);
  });

  it('handles nested and adjacent marks', () => {
    const html = '<p><strong>bold and <em>italic</em></strong> plain</p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      { type: 'paragraph', runs: [
        { text: 'bold and ', bold: true, italic: false, strike: false, code: false },
        { text: 'italic', bold: true, italic: true, strike: false, code: false },
        { text: ' plain', bold: false, italic: false, strike: false, code: false }
      ]}
    ]);
  });

  it('parses a <br> as a forced newline run with current formatting', () => {
    const html = '<p>Line 1<strong>bold<br>still bold</strong></p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      { type: 'paragraph', runs: [
        { text: 'Line 1', bold: false, italic: false, strike: false, code: false },
        { text: 'bold', bold: true, italic: false, strike: false, code: false },
        { text: '\n', bold: true, italic: false, strike: false, code: false },
        { text: 'still bold', bold: true, italic: false, strike: false, code: false }
      ]}
    ]);
  });

  it('parses an empty paragraph (<p></p>)', () => {
    const html = '<p></p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      { type: 'paragraph', runs: [] }
    ]);
  });

  it('parses an out-of-scope element as a plain paragraph fallback', () => {
    const html = '<unknown>Title <strong>bold ignored</strong></unknown>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      { type: 'paragraph', runs: [{ text: 'Title bold ignored', bold: false, italic: false, strike: false, code: false }] }
    ]);
  });

  it('parses multiple paragraphs mixed with fallback elements', () => {
    const html = '<p>First para</p><unknown>Heading</unknown><p>Second <code>code</code> para</p>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      { type: 'paragraph', runs: [{ text: 'First para', bold: false, italic: false, strike: false, code: false }] },
      { type: 'paragraph', runs: [{ text: 'Heading', bold: false, italic: false, strike: false, code: false }] },
      { type: 'paragraph', runs: [
        { text: 'Second ', bold: false, italic: false, strike: false, code: false },
        { text: 'code', bold: false, italic: false, strike: false, code: true },
        { text: ' para', bold: false, italic: false, strike: false, code: false }
      ]}
    ]);
  });

  it('parses a heading block', () => {
    const html = '<h2>Heading 2</h2><h5>Heading 5</h5>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      { type: 'heading', level: 2, runs: [{ text: 'Heading 2', bold: false, italic: false, strike: false, code: false }] },
      { type: 'heading', level: 5, runs: [{ text: 'Heading 5', bold: false, italic: false, strike: false, code: false }] }
    ]);
  });

  it('parses a blockquote containing a paragraph', () => {
    const html = '<blockquote><p>Quote text</p></blockquote>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      {
        type: 'blockquote',
        blocks: [
          { type: 'paragraph', runs: [{ text: 'Quote text', bold: false, italic: false, strike: false, code: false }] }
        ]
      }
    ]);
  });

  it('parses an unordered list with two items', () => {
    const html = '<ul><li><p>Item 1</p></li><li><p>Item 2</p></li></ul>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      {
        type: 'list',
        ordered: false,
        items: [
          [{ type: 'paragraph', runs: [{ text: 'Item 1', bold: false, italic: false, strike: false, code: false }] }],
          [{ type: 'paragraph', runs: [{ text: 'Item 2', bold: false, italic: false, strike: false, code: false }] }]
        ]
      }
    ]);
  });

  it('parses an ordered list with two items', () => {
    const html = '<ol><li><p>Item 1</p></li><li><p>Item 2</p></li></ol>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      {
        type: 'list',
        ordered: true,
        items: [
          [{ type: 'paragraph', runs: [{ text: 'Item 1', bold: false, italic: false, strike: false, code: false }] }],
          [{ type: 'paragraph', runs: [{ text: 'Item 2', bold: false, italic: false, strike: false, code: false }] }]
        ]
      }
    ]);
  });

  it('parses a codeBlock preserving newlines', () => {
    const html = '<pre><code>line1\nline2</code></pre>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      { type: 'codeBlock', text: 'line1\nline2' }
    ]);
  });
});
