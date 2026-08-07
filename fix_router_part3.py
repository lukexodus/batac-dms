import re

with open('apps/server/src/modules/workflow/workflow.router.ts', 'r') as f:
    content = f.read()

new_loop = """          const courier = await outPdf.embedFont(StandardFonts.Courier);

          const fontsForWrapping = {
            regular: helvetica,
            bold: helveticaBold,
            italic: helveticaOblique,
            boldItalic: helveticaBoldOblique,
          };
          const fontByVariant: Record<DrawableRunFragment['font'], typeof helvetica> = {
            regular: helvetica,
            bold: helveticaBold,
            italic: helveticaOblique,
            boldItalic: helveticaBoldOblique,
            code: helvetica,
          };

          for (const item of textOnlyContents) {
            let textPage = outPdf.addPage([pageW, pageH]);
            textReportPagesCount++;
            let textY = contentTopY;

            textPage.drawText(item.committeeName, {
              x: 60,
              y: textY,
              size: 13,
              font: helveticaBold,
              color: rgb(0, 0, 0),
              maxWidth: contentMaxWidth,
            });
            textY -= 24;

            const activeRules: { marginX: number; startY: number; page: any; color: any; width: number }[] = [];

            const checkPageOverflow = () => {
              if (textY < contentBottomY) {
                for (const rule of activeRules) {
                  rule.page.drawRectangle({
                    x: rule.marginX,
                    y: textY + 12,
                    width: rule.width,
                    height: rule.startY - (textY + 12),
                    color: rule.color,
                  });
                }
                textPage = outPdf.addPage([pageW, pageH]);
                textReportPagesCount++;
                textY = contentTopY;
                for (const rule of activeRules) {
                  rule.startY = textY + 12;
                  rule.page = textPage;
                }
              }
            };

            const drawBlock = (block: PdfBlock, marginX: number, forceItalic: boolean) => {
              if (block.type === 'paragraph') {
                const lines = wrapRunsForPdf(block.runs, fontsForWrapping, textSize, contentMaxWidth - (marginX - 60));
                for (const line of lines) {
                  checkPageOverflow();
                  let cursorX = marginX;
                  for (const fragment of line) {
                    const variant = forceItalic ? (fragment.font === 'bold' || fragment.font === 'boldItalic' ? 'boldItalic' : 'italic') : fragment.font;
                    const font = fontByVariant[variant === 'code' ? 'regular' : variant];
                    textPage.drawText(fragment.text, { x: cursorX, y: textY, size: textSize, font, color: rgb(0, 0, 0) });
                    cursorX += font.widthOfTextAtSize(fragment.text, textSize);
                  }
                  textY -= textLineHeight;
                }
              } else if (block.type === 'heading') {
                const hSize = PDF_REPORT_STYLE.headingSizes[`h${block.level}` as keyof typeof PDF_REPORT_STYLE.headingSizes];
                textY -= PDF_REPORT_STYLE.headingSpacingBefore;
                const lines = wrapRunsForPdf(block.runs, fontsForWrapping, hSize, contentMaxWidth - (marginX - 60));
                for (const line of lines) {
                  checkPageOverflow();
                  let cursorX = marginX;
                  for (const fragment of line) {
                    const variant = forceItalic ? (fragment.font === 'bold' || fragment.font === 'boldItalic' ? 'boldItalic' : 'italic') : fragment.font;
                    const font = fontByVariant[variant === 'code' ? 'regular' : variant];
                    textPage.drawText(fragment.text, { x: cursorX, y: textY, size: hSize, font, color: rgb(0, 0, 0) });
                    cursorX += font.widthOfTextAtSize(fragment.text, hSize);
                  }
                  textY -= (hSize + 4);
                }
                textY -= PDF_REPORT_STYLE.headingSpacingAfter;
              } else if (block.type === 'blockquote') {
                const ruleMarginX = marginX;
                const newMarginX = marginX + PDF_REPORT_STYLE.blockquote.leftPadding;
                const rule = {
                  marginX: ruleMarginX,
                  startY: textY + 12,
                  page: textPage,
                  color: rgb(...PDF_REPORT_STYLE.blockquote.ruleColorRgb),
                  width: PDF_REPORT_STYLE.blockquote.ruleWidth,
                };
                activeRules.push(rule);
                
                for (const b of block.blocks) {
                  drawBlock(b, newMarginX, PDF_REPORT_STYLE.blockquote.italic || forceItalic);
                }
                
                activeRules.pop();
                rule.page.drawRectangle({
                  x: rule.marginX,
                  y: textY + 12,
                  width: rule.width,
                  height: rule.startY - (textY + 12),
                  color: rule.color,
                });
              } else if (block.type === 'list') {
                const newMarginX = marginX + PDF_REPORT_STYLE.list.indentPerLevel;
                for (let i = 0; i < block.items.length; i++) {
                  const item = block.items[i];
                  checkPageOverflow();
                  const bullet = block.ordered ? `${i + 1}${PDF_REPORT_STYLE.list.orderedSeparator}` : PDF_REPORT_STYLE.list.bulletChar;
                  
                  textPage.drawText(bullet, {
                    x: marginX,
                    y: textY,
                    size: textSize,
                    font: helvetica,
                    color: rgb(0, 0, 0),
                  });
                  
                  const initialTextY = textY;
                  for (const b of item) {
                    drawBlock(b, newMarginX, forceItalic);
                  }
                  
                  if (initialTextY === textY) {
                    textY -= textLineHeight;
                  }
                }
              } else if (block.type === 'codeBlock') {
                const codeMaxWidth = contentMaxWidth - (marginX - 60) - PDF_REPORT_STYLE.codeBlock.leftPadding;
                const lines = wrapPdfText(block.text, courier, textSize, codeMaxWidth);
                
                checkPageOverflow();
                textPage.drawRectangle({
                  x: marginX,
                  y: textY + 12,
                  width: contentMaxWidth - (marginX - 60),
                  height: PDF_REPORT_STYLE.codeBlock.topBottomPadding,
                  color: rgb(...PDF_REPORT_STYLE.codeBlock.backgroundColorRgb),
                });
                
                for (const line of lines) {
                  checkPageOverflow();
                  textPage.drawRectangle({
                    x: marginX,
                    y: textY - 4,
                    width: contentMaxWidth - (marginX - 60),
                    height: textLineHeight,
                    color: rgb(...PDF_REPORT_STYLE.codeBlock.backgroundColorRgb),
                  });
                  textPage.drawText(line, {
                    x: marginX + PDF_REPORT_STYLE.codeBlock.leftPadding,
                    y: textY,
                    size: textSize,
                    font: courier,
                    color: rgb(0, 0, 0),
                  });
                  textY -= textLineHeight;
                }
                
                checkPageOverflow();
                textPage.drawRectangle({
                  x: marginX,
                  y: textY + 12 - PDF_REPORT_STYLE.codeBlock.topBottomPadding,
                  width: contentMaxWidth - (marginX - 60),
                  height: PDF_REPORT_STYLE.codeBlock.topBottomPadding,
                  color: rgb(...PDF_REPORT_STYLE.codeBlock.backgroundColorRgb),
                });
                textY -= PDF_REPORT_STYLE.codeBlock.topBottomPadding;
              }
            };

            const blocks = parseRichTextForPdf(item.text);
            for (const block of blocks) {
              drawBlock(block, 60, false);
            }
          }"""

old_loop = r"""          const fontsForWrapping = \{
            regular: helvetica,
            bold: helveticaBold,
            italic: helveticaOblique,
            boldItalic: helveticaBoldOblique,
          \};
          const fontByVariant: Record<DrawableRunFragment\['font'\], typeof helvetica> = \{
            regular: helvetica,
            bold: helveticaBold,
            italic: helveticaOblique,
            boldItalic: helveticaBoldOblique,
            code: helvetica,
          \};

          for \(const item of textOnlyContents\) \{
            let textPage = outPdf.addPage\(\[pageW, pageH\]\);
            textReportPagesCount\+\+;
            let textY = contentTopY;
            textPage.drawText\(item.committeeName, \{
              x: 60,
              y: textY,
              size: 13,
              font: helveticaBold,
              color: rgb\(0, 0, 0\),
              maxWidth: contentMaxWidth,
            \}\);
            textY -= 24;

            const paragraphs = parseRichTextForPdf\(item.text\);
            for \(const paragraph of paragraphs\) \{
              const lines = wrapRunsForPdf\(paragraph, fontsForWrapping, textSize, contentMaxWidth\);
              for \(const line of lines\) \{
                if \(textY < contentBottomY\) \{
                  textPage = outPdf.addPage\(\[pageW, pageH\]\);
                  textReportPagesCount\+\+;
                  textY = contentTopY;
                \}
                let cursorX = 60;
                for \(const fragment of line\) \{
                  const font = fontByVariant\[fragment.font\];
                  textPage.drawText\(fragment.text, \{
                    x: cursorX,
                    y: textY,
                    size: textSize,
                    font,
                    color: rgb\(0, 0, 0\),
                  \}\);
                  cursorX \+= font.widthOfTextAtSize\(fragment.text, textSize\);
                \}
                textY -= textLineHeight;
              \}
            \}
          \}"""

content = re.sub(old_loop, new_loop, content)

with open('apps/server/src/modules/workflow/workflow.router.ts', 'w') as f:
    f.write(content)

