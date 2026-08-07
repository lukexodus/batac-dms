import os
import re

print("Applying fixes...")

def read_file(path):
    with open(path, 'r') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w') as f:
        f.write(content)

# Fix 2: Import statement corrections in two panels
files_to_fix_imports = [
    'apps/web/src/pages/workflow/panels/PanlalawiganOutcomePanel.tsx',
    'apps/web/src/pages/workflow/panels/MultiReferralPanel.tsx'
]
for file_path in files_to_fix_imports:
    content = read_file(file_path)
    if 'Textarea' in content and 'RichTextEditor' not in content:
        content = re.sub(r'\bTextarea\b', 'RichTextEditor', content, count=1)
        write_file(file_path, content)

# Fix 3: Wire isRichTextEmpty into all 13 panels' required-field checks
panels_dir = 'apps/web/src/pages/workflow/panels/'
checks_to_replace = {
    'GenericApprovalPanel.tsx': [
        (r'if \(!comment\) {', r'if (isRichTextEmpty(comment)) {')
    ],
    'AmendmentsLoggingPanel.tsx': [
        (r'disabled={completeMutation\.isPending \|\| !comment\.trim\(\)}', r'disabled={completeMutation.isPending || isRichTextEmpty(comment)}')
    ],
    'CommitteeRevisionsDecisionPanel.tsx': [
        (r'if \(!remarks\) {', r'if (isRichTextEmpty(remarks)) {')
    ],
    'LegalOfficeReviewDecisionPanel.tsx': [
        (r'if \(!remarks\) {', r'if (isRichTextEmpty(remarks)) {')
    ],
    'ReturnedReviewDecisionPanel.tsx': [
        (r'if \(!remarks\) {', r'if (isRichTextEmpty(remarks)) {')
    ],
    'SecretariatDecisionPanel.tsx': [
        (r'if \(requireRemarks && !remarks\) {', r'if (requireRemarks && isRichTextEmpty(remarks)) {')
    ],
    'MayorDecisionPanel.tsx': [
        (r'if \(!objectionsText\) {', r'if (isRichTextEmpty(objectionsText)) {')
    ],
    'ValidInPartDecisionPanel.tsx': [
        (r'if \(!mandatoryComment\) {', r'if (isRichTextEmpty(mandatoryComment)) {')
    ],
    'MultiReferralPanel.tsx': [
        (r'if \(!reportText && !reportFile\) {', r'if (isRichTextEmpty(reportText) && !reportFile) {')
    ],
    'PanlalawiganOutcomePanel.tsx': [
        (r'if \(!mandatoryComment\) {', r'if (isRichTextEmpty(mandatoryComment)) {')
    ]
}

# The files requiring just the import but no change:
# GenericActionPanel.tsx, TransmittalLetterPanel.tsx, OrderOfBusinessSchedulingPanel.tsx?
# Wait, the prompt says "Add this import to each of the 13 files listed below".
# The table has 11 rows. The note says "GenericActionPanel.tsx and TransmittalLetterPanel.tsx have no required-field check... do not add one".
# But it says "Add this import to each of the 13 files listed below". 
# Wait, for Fix 7 I also need to add isRichTextEmpty to OrderOfBusinessSchedulingPanel.tsx.

thirteen_files = [
    'GenericApprovalPanel.tsx', 'AmendmentsLoggingPanel.tsx', 'CommitteeRevisionsDecisionPanel.tsx',
    'LegalOfficeReviewDecisionPanel.tsx', 'ReturnedReviewDecisionPanel.tsx', 'SecretariatDecisionPanel.tsx',
    'MayorDecisionPanel.tsx', 'ValidInPartDecisionPanel.tsx', 'MultiReferralPanel.tsx', 'PanlalawiganOutcomePanel.tsx',
    'GenericActionPanel.tsx', 'TransmittalLetterPanel.tsx', 'OrderOfBusinessSchedulingPanel.tsx'
]

for file_name in thirteen_files:
    file_path = os.path.join(panels_dir, file_name)
    content = read_file(file_path)
    
    # Add import if missing
    if 'isRichTextEmpty' not in content:
        # Find first import and insert after
        content = re.sub(r'^(import [^\n]+;)$', r'\1\nimport { isRichTextEmpty } from \'@/lib/rich-text\';', content, count=1, flags=re.MULTILINE)
    
    if file_name in checks_to_replace:
        for old, new in checks_to_replace[file_name]:
            content = re.sub(old, new, content)
            
    write_file(file_path, content)

# Fix 4: apps/server/src/modules/workflow/workflow.router.ts: submitApprovalOutcome sanitization
router_path = 'apps/server/src/modules/workflow/workflow.router.ts'
router_content = read_file(router_path)
# We need to find `submitApprovalOutcome` procedure and replace within it.
old_str_4 = "const { stepInstanceId, outcome, comment = null } = input;"
new_str_4 = """const sanitizedComment = input.comment ? sanitizeRichText(input.comment) : undefined;
        const { stepInstanceId, outcome } = input;
        const comment = sanitizedComment ?? null;"""

# To be safe, only replace within submitApprovalOutcome block. 
# We'll locate the string "submitApprovalOutcome" and find the first occurrence of old_str_4 after it.
submit_index = router_content.find('submitApprovalOutcome')
if submit_index != -1:
    old_index = router_content.find(old_str_4, submit_index)
    if old_index != -1:
        router_content = router_content[:old_index] + new_str_4 + router_content[old_index + len(old_str_4):]

write_file(router_path, router_content)

# Fix 5: submitCommitteeReport: rebuild
old_str_5 = """.mutation(async ({ input, ctx }) => {
        if (input.reportText && isRichTextEmpty(input.reportText)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Report text is required if provided.' });
        if (input.reportText) input.reportText = sanitizeRichText(input.reportText);

        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, committeeId } = input;

        if (!input.reportText && !input.documentId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Provide report text and/or an uploaded report document.',
          });
        }"""
new_str_5 = """.mutation(async ({ input, ctx }) => {
        if (!ctx.auth) {
          throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required.' });
        }

        const { stepInstanceId, committeeId } = input;
        const sanitizedReportText = input.reportText ? sanitizeRichText(input.reportText) : undefined;

        if (isRichTextEmpty(sanitizedReportText) && !input.documentId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Provide report text and/or an uploaded report document.',
          });
        }"""

router_content = read_file(router_path)
submit_cr_index = router_content.find('submitCommitteeReport')
if submit_cr_index != -1:
    mutation_start = router_content.find('.mutation(async ({ input, ctx }) => {', submit_cr_index)
    if mutation_start != -1:
        # We replace old_str_5 with new_str_5
        if old_str_5 in router_content:
             router_content = router_content.replace(old_str_5, new_str_5, 1)
        else:
             print("Fix 5 old_str_5 not found exactly, trying regex")
             
        # After replacement, search the rest of this procedure's body and replace `input.reportText` with `sanitizedReportText`.
        # Find the end of the procedure by looking for the next procedure or end of file.
        next_proc = router_content.find('  }),\n\n', submit_cr_index)
        if next_proc == -1: next_proc = len(router_content)
        
        proc_body = router_content[mutation_start:next_proc]
        
        # Avoid replacing the `input.reportText` in the new_str_5 assignment:
        # const sanitizedReportText = input.reportText ? sanitizeRichText(input.reportText) : undefined;
        # We will manually replace input.reportText only after the `if (isRichTextEmpty(sanitizedReportText)...)` block
        end_of_new_str = proc_body.find('message: \'Provide report text and/or an uploaded report document.\',\n          });\n        }')
        if end_of_new_str != -1:
            part1 = proc_body[:end_of_new_str + 96]
            part2 = proc_body[end_of_new_str + 96:]
            part2 = part2.replace('input.reportText', 'sanitizedReportText')
            router_content = router_content[:mutation_start] + part1 + part2 + router_content[next_proc:]
            
write_file(router_path, router_content)


# Fix 6: action.handler.ts: remove unrequested second sanitization call
handler_path = 'apps/server/src/modules/workflow/engine/step-handlers/action.handler.ts'
handler_content = read_file(handler_path)
handler_content = handler_content.replace(
    'const sanitizedComment = comment ? sanitizeRichText(comment) : null;\n\n  const now = new Date();',
    'const now = new Date();'
)
handler_content = handler_content.replace(
    'outcome: \'DONE\',\n        comment: sanitizedComment,\n      },\n    },\n    trx,\n  );\n\n  // Refresh stepInstance state before resolving next step',
    'outcome: \'DONE\',\n        comment,\n      },\n    },\n    trx,\n  );\n\n  // Refresh stepInstance state before resolving next step'
)
handler_content = handler_content.replace(
    'import { isRichTextEmpty, sanitizeRichText } from \'../../rich-text.util.js\';',
    'import { isRichTextEmpty } from \'../../rich-text.util.js\';'
)
write_file(handler_path, handler_content)


# Fix 7: OrderOfBusinessSchedulingPanel.tsx
oob_path = 'apps/web/src/pages/workflow/panels/OrderOfBusinessSchedulingPanel.tsx'
oob_content = read_file(oob_path)
old_str_7 = """  const handleScheduleAndComplete = async () => {
    try {
      await scheduleMutation.mutateAsync({
        documentId: instance.documentId,
        sessionDate: new Date(selectedDate),
      });
    } catch {
      // Handled by onError
    }
  };"""
new_str_7 = """  const handleScheduleAndComplete = async () => {
    try {
      await scheduleMutation.mutateAsync({
        documentId: instance.documentId,
        sessionDate: new Date(selectedDate),
        comment: isRichTextEmpty(comment) ? undefined : comment,
      });
    } catch {
      // Handled by onError
    }
  };"""
oob_content = oob_content.replace(old_str_7, new_str_7)
write_file(oob_path, oob_content)

# We must also update session.router.ts!
session_router_path = 'apps/server/src/modules/workflow/session.router.ts'
session_router_content = read_file(session_router_path)

if 'comment: z.string().optional()' not in session_router_content:
    print("Fix 7: adding optional comment to scheduleDocumentForFirstReading schema")
    session_router_content = session_router_content.replace(
        'sessionDate: z.coerce.date(),\n        }),\n      )\n      .mutation(async ({ input, ctx }) => {',
        'sessionDate: z.coerce.date(),\n          comment: z.string().optional(),\n        }),\n      )\n      .mutation(async ({ input, ctx }) => {'
    )
    
    # We must also sanitize the comment
    # Look for: const { documentId, sessionDate } = input;
    session_router_content = session_router_content.replace(
        'const { documentId, sessionDate } = input;',
        'const { documentId, sessionDate } = input;\n        const sanitizedComment = input.comment ? sanitizeRichText(input.comment) : undefined;'
    )
    
    # And we must use sanitizedComment anywhere the comment is persisted or emitted.
    # Where does scheduleDocumentForFirstReading use the comment?
    # Let's see if we need to also import sanitizeRichText.
    if 'sanitizeRichText' not in session_router_content:
        session_router_content = re.sub(r'^(import [^\n]+;)$', r'\1\nimport { sanitizeRichText } from \'./rich-text.util.js\';', session_router_content, count=1, flags=re.MULTILINE)
        
    write_file(session_router_path, session_router_content)

# Fix 8: MultiReferralPanel.tsx display-site markup
mr_path = 'apps/web/src/pages/workflow/panels/MultiReferralPanel.tsx'
mr_content = read_file(mr_path)

old_str_8_pattern = r'\{submission\.reportText && \(\s*<div\s*className="prose prose-sm max-w-none"\s*dangerouslySetInnerHTML={{ __html: submission\.reportText }}\s*/>\s*\)\}'
new_str_8 = """{submission.reportText && (
  <div
    className="line-clamp-2 text-sm text-muted-foreground [&_p]:m-0 [&_strong]:font-semibold [&_em]:italic"
    dangerouslySetInnerHTML={{ __html: submission.reportText }}
  />
)}"""
# Because typography plugin is not installed, we use the fallback string: text-sm text-muted-foreground [&_p]:m-0 [&_strong]:font-semibold [&_em]:italic

if re.search(old_str_8_pattern, mr_content):
    mr_content = re.sub(old_str_8_pattern, new_str_8, mr_content)
else:
    # Try finding `<p className="line-clamp-2 whitespace-pre-wrap">` block
    old_str_8_alt = r'\{submission\.reportText && \(\s*<p className="line-clamp-2 whitespace-pre-wrap">\s*<div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: submission\.reportText }} />\s*</p>\s*\)\}'
    if re.search(old_str_8_alt, mr_content):
        mr_content = re.sub(old_str_8_alt, new_str_8, mr_content)

write_file(mr_path, mr_content)

# Fix 9: RichTextEditor.tsx
rte_path = 'packages/ui/src/components/domain/RichTextEditor.tsx'
rte_content = read_file(rte_path)
rte_content = rte_content.replace(
    '\'flex flex-col border border-border-default rounded-md overflow-hidden bg-white\',',
    '\'flex flex-col border border-border-default rounded-md overflow-hidden bg-surface-base\','
)
write_file(rte_path, rte_content)

# Fix 10: RichTextEditorPage.tsx
dev_page_path = 'apps/web/src/pages/dev/RichTextEditorPage.tsx'
dev_page_content = read_file(dev_page_path)
old_str_10 = """      <Card>
        <CardHeader>
          <CardTitle>Initial Content Example</CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value="<p>This is some <strong>initial</strong> content with <em>formatting</em>.</p><ul><li>List item 1</li><li>List item 2</li></ul>"
            onChange={() => {}}
          />
        </CardContent>
      </Card>
    </div>
  );
}"""

new_str_10 = """      <Card>
        <CardHeader>
          <CardTitle>Initial Content Example</CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value="<p>This is some <strong>initial</strong> content with <em>formatting</em>.</p><ul><li>List item 1</li><li>List item 2</li></ul>"
            onChange={() => {}}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disabled / Read-Only Example</CardTitle>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value="<p>This is some <strong>initial</strong> content with <em>formatting</em>.</p><ul><li>List item 1</li><li>List item 2</li></ul>"
            onChange={() => {}}
            disabled={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}"""
dev_page_content = dev_page_content.replace(old_str_10, new_str_10)
write_file(dev_page_path, dev_page_content)

print("Done with script fixes.")
