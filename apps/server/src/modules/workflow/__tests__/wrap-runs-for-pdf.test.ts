import { describe, it, expect } from 'vitest';
import { wrapRunsForPdf } from '../workflow.router.js';

describe('wrapRunsForPdf', () => {
  const dummyFont = {
    widthOfTextAtSize: (text: string, size: number) => text.length * size, // 1 char = 1 * size width
  };
  const fonts = {
    regular: dummyFont,
    bold: dummyFont,
    italic: dummyFont,
    boldItalic: dummyFont,
  };
  const size = 10;
  const maxWidth = 1000; // Large enough that word wrapping isn't triggered, only explicit newlines

  it('produces two separate DrawableLine entries for an embedded \\n character', () => {
    const paragraph = [
      { text: 'Line1\nLine2', bold: false, italic: false, strike: false, code: false }
    ];
    const result = wrapRunsForPdf(paragraph, fonts, size, maxWidth);
    expect(result).toEqual([
      [{ text: 'Line1', font: 'regular' }],
      [{ text: 'Line2', font: 'regular' }]
    ]);
  });

  it('forces a line break without being skipped for a run that is only \\n characters', () => {
    const paragraph = [
      { text: 'A', bold: false, italic: false, strike: false, code: false },
      { text: '\n', bold: false, italic: false, strike: false, code: false },
      { text: 'B', bold: false, italic: false, strike: false, code: false }
    ];
    const result = wrapRunsForPdf(paragraph, fonts, size, maxWidth);
    expect(result).toEqual([
      [{ text: 'A', font: 'regular' }],
      [{ text: 'B', font: 'regular' }]
    ]);
  });

  it('forces an empty line for consecutive \\n characters', () => {
    const paragraph = [
      { text: 'A\n\nB', bold: false, italic: false, strike: false, code: false }
    ];
    const result = wrapRunsForPdf(paragraph, fonts, size, maxWidth);
    expect(result).toEqual([
      [{ text: 'A', font: 'regular' }],
      [],
      [{ text: 'B', font: 'regular' }]
    ]);
  });

  it('handles a leading newline', () => {
    const paragraph = [
      { text: '\nA', bold: false, italic: false, strike: false, code: false }
    ];
    const result = wrapRunsForPdf(paragraph, fonts, size, maxWidth);
    expect(result).toEqual([
      [],
      [{ text: 'A', font: 'regular' }]
    ]);
  });

  it('handles a trailing newline', () => {
    const paragraph = [
      { text: 'A\n', bold: false, italic: false, strike: false, code: false }
    ];
    const result = wrapRunsForPdf(paragraph, fonts, size, maxWidth);
    expect(result).toEqual([
      [{ text: 'A', font: 'regular' }]
    ]);
  });
});
