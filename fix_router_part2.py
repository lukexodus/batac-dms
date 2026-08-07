import re

with open('apps/server/src/modules/workflow/workflow.router.ts', 'r') as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    "import { parseRichTextForPdf } from './rich-text-pdf.util.js';\nimport type { ParsedParagraph } from './rich-text-pdf.util.js';",
    "import { parseRichTextForPdf, PDF_REPORT_STYLE } from './rich-text-pdf.util.js';\nimport type { PdfBlock } from './rich-text-pdf.util.js';"
)

content = content.replace(
    "ParsedParagraph",
    "PdfBlock['runs']"
) # wait, wrapRunsForPdf signature uses ParsedParagraph. I'll replace it with `PdfBlock` wait, no, wrapRunsForPdf takes `TextRun[]`. Let's just replace ParsedParagraph with `any` or `import type { TextRun }` and `TextRun[]`.

