import { JSDOM } from 'jsdom';

export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  underline: boolean;
  href: string | null;
}

export const PDF_REPORT_STYLE = {
  headingSizes: { h1: 16, h2: 14, h3: 13, h4: 13, h5: 13, h6: 13 },
  headingSpacingBefore: 10,
  headingSpacingAfter: 4,
  blockquote: {
    leftPadding: 14,
    ruleWidth: 2,
    ruleColorRgb: [0.6, 0.6, 0.6] as [number, number, number],
    italic: true,
  },
  list: {
    indentPerLevel: 18,
    bulletChar: '•',
    orderedSeparator: '.',
  },
  codeBlock: {
    leftPadding: 10,
    topBottomPadding: 6,
    backgroundColorRgb: [0.95, 0.95, 0.95] as [number, number, number],
  },
} as const;

export type PdfBlock =
  | { type: 'paragraph'; runs: TextRun[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; runs: TextRun[] }
  | { type: 'blockquote'; blocks: PdfBlock[] }
  | { type: 'list'; ordered: boolean; items: PdfBlock[][] }
  | { type: 'codeBlock'; text: string };

export function parseRichTextForPdf(html: string): PdfBlock[] {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  const blocks: PdfBlock[] = [];

  if (body.children.length === 0) {
    const textContent = body.textContent?.trim() || '';
    if (textContent) {
      blocks.push({
        type: 'paragraph',
        runs: [{ text: textContent, bold: false, italic: false, strike: false, code: false, underline: false, href: null }],
      });
    }
    return blocks;
  }

  for (let i = 0; i < body.children.length; i++) {
    const child = body.children[i] as Element;
    const parsed = parseBlock(child);
    if (parsed) {
      blocks.push(parsed);
    }
  }

  return blocks;
}

function parseBlock(element: Element): PdfBlock | null {
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'p') {
    const runs: TextRun[] = [];
    walkNode(element, runs, { bold: false, italic: false, strike: false, code: false, underline: false }, null);
    return { type: 'paragraph', runs };
  }

  if (tagName.match(/^h[1-6]$/)) {
    const level = parseInt(tagName.charAt(1), 10) as 1 | 2 | 3 | 4 | 5 | 6;
    const runs: TextRun[] = [];
    walkNode(element, runs, { bold: false, italic: false, strike: false, code: false, underline: false }, null);
    return { type: 'heading', level, runs };
  }

  if (tagName === 'blockquote') {
    const blocks: PdfBlock[] = [];
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i] as Element;
      const parsed = parseBlock(child);
      if (parsed) blocks.push(parsed);
    }
    return { type: 'blockquote', blocks };
  }

  if (tagName === 'ul' || tagName === 'ol') {
    const ordered = tagName === 'ol';
    const items: PdfBlock[][] = [];
    for (let i = 0; i < element.children.length; i++) {
      const li = element.children[i] as Element;
      if (li.tagName.toLowerCase() === 'li') {
        const itemBlocks: PdfBlock[] = [];
        for (let j = 0; j < li.children.length; j++) {
          const child = li.children[j] as Element;
          const parsed = parseBlock(child);
          if (parsed) itemBlocks.push(parsed);
        }
        // If an li has bare text without a p, parseBlock on element.children will miss it.
        // But starterkit always wraps li content in p. If it misses bare text, we should handle it.
        // Let's check if li has no element children but has text.
        if (li.children.length === 0) {
          const textContent = li.textContent?.trim() || '';
          if (textContent) {
            itemBlocks.push({
              type: 'paragraph',
              runs: [{ text: textContent, bold: false, italic: false, strike: false, code: false, underline: false, href: null }],
            });
          }
        }
        items.push(itemBlocks);
      }
    }
    return { type: 'list', ordered, items };
  }

  if (tagName === 'pre') {
    return { type: 'codeBlock', text: element.textContent || '' };
  }

  // Fallback for unrecognized block elements
  const textContent = element.textContent?.trim() || '';
  if (textContent) {
    return {
      type: 'paragraph',
      runs: [{ text: textContent, bold: false, italic: false, strike: false, code: false, underline: false, href: null }],
    };
  }

  return null;
}

interface FormatState {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  underline: boolean;
}

function walkNode(node: Node, runs: TextRun[], state: FormatState, href: string | null) {
  if (node.nodeType === 3) {
    // Node.TEXT_NODE
    const text = node.textContent;
    if (text) {
      runs.push({
        text,
        bold: state.bold,
        italic: state.italic,
        strike: state.strike,
        code: state.code,
        underline: state.underline,
        href,
      });
    }
    return;
  }

  if (node.nodeType === 1) {
    // Node.ELEMENT_NODE
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'br') {
      runs.push({
        text: '\n',
        bold: state.bold,
        italic: state.italic,
        strike: state.strike,
        code: state.code,
        underline: state.underline,
        href,
      });
      return;
    }

    const newState = { ...state };
    if (tagName === 'strong' || tagName === 'b') newState.bold = true;
    if (tagName === 'em' || tagName === 'i') newState.italic = true;
    if (tagName === 's' || tagName === 'strike' || tagName === 'del') newState.strike = true;
    if (tagName === 'u') newState.underline = true;
    if (tagName === 'code') newState.code = true;

    let childHref = href;
    if (tagName === 'a') {
      childHref = element.getAttribute('href') ?? href;
    }

    for (let i = 0; i < node.childNodes.length; i++) {
      walkNode(node.childNodes[i] as Node, runs, newState, childHref);
    }
  }
}
