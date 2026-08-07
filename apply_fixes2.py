import os

# Fix 7: session.router.ts
session_router_path = 'apps/server/src/modules/workflow/session.router.ts'
with open(session_router_path, 'r') as f:
    content = f.read()

# Part A - session.router.ts schema
old_str_7a = """      .input(
        z.object({
          documentId: z.string().uuid(),
          sessionDate: z.coerce.date(),
        }),
      )"""
new_str_7a = """      .input(
        z.object({
          documentId: z.string().uuid(),
          sessionDate: z.coerce.date(),
          comment: z.string().optional(),
        }),
      )"""
if old_str_7a in content:
    content = content.replace(old_str_7a, new_str_7a)

# Part B - sanitize and thread value
old_str_7b = """              await submitStepAction(
                instance,
                stepInstance,
                ctx.auth.userId,
                null,
                deps as any,
                tx
              );"""
new_str_7b = """              const sanitizedComment = input.comment ? sanitizeRichText(input.comment) : null;
              await submitStepAction(
                instance,
                stepInstance,
                ctx.auth.userId,
                sanitizedComment,
                deps as any,
                tx
              );"""
if old_str_7b in content:
    content = content.replace(old_str_7b, new_str_7b)

# Import
old_str_import = "import { submitStepAction } from './engine/step-handlers/action.handler.js';"
new_str_import = """import { submitStepAction } from './engine/step-handlers/action.handler.js';
import { sanitizeRichText } from './rich-text.util.js';"""
if old_str_import in content:
    content = content.replace(old_str_import, new_str_import)
else:
    # fallback to just finding the line with submitStepAction
    import re
    content = re.sub(r'import\s+\{[^}]*submitStepAction[^}]*\}\s+from\s+[^;]+;', lambda m: m.group(0) + "\nimport { sanitizeRichText } from './rich-text.util.js';", content)

with open(session_router_path, 'w') as f:
    f.write(content)

# Fix 11: RichTextEditor.tsx
rte_path = 'packages/ui/src/components/domain/RichTextEditor.tsx'
with open(rte_path, 'r') as f:
    rte_content = f.read()

old_str_11 = """        class: cn(
          'prose prose-sm max-w-none focus:outline-none w-full p-3',
          `min-h-[${minHeight}]`
        ),"""
new_str_11 = """        class: cn(
          'max-w-none focus:outline-none w-full p-3 [&_p]:m-0 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic',
          `min-h-[${minHeight}]`
        ),"""
if old_str_11 in rte_content:
    rte_content = rte_content.replace(old_str_11, new_str_11)

with open(rte_path, 'w') as f:
    f.write(rte_content)

print("Applied Fix 7 and 11.")
