import re

with open('apps/server/src/modules/workflow/__tests__/rich-text-pdf.test.ts', 'r') as f:
    content = f.read()

# Update the tests that expect `[[ {text, bold, ...} ]]` to expect `[{ type: 'paragraph', runs: [{text, bold, ...}] }]`

content = re.sub(
    r"expect\(result\)\.toEqual\(\[\n\s*\[\n",
    "expect(result).toEqual([\n      { type: 'paragraph', runs: [\n",
    content
)

content = re.sub(
    r"\s*\]\n\s*\]\);",
    "\n      ] }\n    ]);",
    content
)

# And add new tests
new_tests = """  it('parses a heading block', () => {
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
    const html = '<pre><code>line1\\nline2</code></pre>';
    const result = parseRichTextForPdf(html);
    expect(result).toEqual([
      { type: 'codeBlock', text: 'line1\\nline2' }
    ]);
  });
});"""

content = content.replace("});\n", new_tests + "\n")

with open('apps/server/src/modules/workflow/__tests__/rich-text-pdf.test.ts', 'w') as f:
    f.write(content)

