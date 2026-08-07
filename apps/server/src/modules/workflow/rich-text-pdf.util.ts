import { JSDOM } from 'jsdom';

export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
}

export type ParsedParagraph = TextRun[];

/**
 * Parses a sanitized HTML string (as produced by sanitizeRichText in
 * rich-text.util.ts) into a sequence of paragraphs, each a sequence of
 * text runs carrying inline formatting state.
 *
 * Scope: only <p> is treated as a true paragraph with inline mark parsing
 * (bold via <strong>/<b>, italic via <em>/<i>, strike via <s>/<strike>/<del>,
 * inline code via <code>). Any other block-level element (headings,
 * blockquote, lists, pre) has its full text content extracted and emitted
 * as a single plain run (no marks) forming its own paragraph - this is the
 * explicit, intentional fallback for elements out of scope this pass, not
 * a bug. Do not throw or skip content for unrecognized block elements.
 *
 * Uses jsdom (already a project dependency) to parse the HTML - do not
 * introduce a new HTML-parsing dependency.
 */
export function parseRichTextForPdf(html: string): ParsedParagraph[] {
  const dom = new JSDOM(html);
  const body = dom.window.document.body;
  const paragraphs: ParsedParagraph[] = [];

  if (body.children.length === 0) {
    const textContent = body.textContent?.trim() || '';
    if (textContent) {
      paragraphs.push([{ text: textContent, bold: false, italic: false, strike: false, code: false }]);
    }
    return paragraphs;
  }

  for (let i = 0; i < body.children.length; i++) {
    const child = body.children[i] as Element;
    const tagName = child.tagName.toLowerCase();

    if (tagName === 'p') {
      const runs: TextRun[] = [];
      walkNode(child, runs, { bold: false, italic: false, strike: false, code: false });
      paragraphs.push(runs);
    } else {
      const textContent = child.textContent?.trim() || '';
      if (textContent) {
        paragraphs.push([{ text: textContent, bold: false, italic: false, strike: false, code: false }]);
      }
    }
  }

  return paragraphs;
}

interface FormatState {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
}

function walkNode(node: Node, runs: TextRun[], state: FormatState) {
  if (node.nodeType === 3) { // Node.TEXT_NODE
    const text = node.textContent;
    if (text) {
      runs.push({
        text,
        bold: state.bold,
        italic: state.italic,
        strike: state.strike,
        code: state.code,
      });
    }
    return;
  }

  if (node.nodeType === 1) { // Node.ELEMENT_NODE
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'br') {
      runs.push({
        text: '\n',
        bold: state.bold,
        italic: state.italic,
        strike: state.strike,
        code: state.code,
      });
      return;
    }

    const newState = { ...state };
    if (tagName === 'strong' || tagName === 'b') newState.bold = true;
    if (tagName === 'em' || tagName === 'i') newState.italic = true;
    if (tagName === 's' || tagName === 'strike' || tagName === 'del') newState.strike = true;
    if (tagName === 'code') newState.code = true;

    for (let i = 0; i < node.childNodes.length; i++) {
      walkNode(node.childNodes[i] as Node, runs, newState);
    }
  }
}
