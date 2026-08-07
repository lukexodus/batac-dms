import os
import re
import glob

def fix_imports_again():
    # Fix RichTextEditorPage and DocumentDetailPage
    for path in ['apps/web/src/pages/dev/RichTextEditorPage.tsx', 'apps/web/src/pages/documents/DocumentDetailPage.tsx']:
        with open(path, 'r') as f:
            content = f.read()
        
        # We need to ensure there are no consecutive blank lines in the import block, 
        # and no blank lines at the top of the file.
        while content.startswith('\n'):
            content = content[1:]
            
        import_end = content.find('\n\nexport')
        if import_end == -1: import_end = content.find('\n\nconst')
        if import_end != -1:
            import_block = content[:import_end]
            import_block = re.sub(r'\n{2,}', '\n\n', import_block)
            content = import_block + content[import_end:]
            
        with open(path, 'w') as f:
            f.write(content)
            
    # Move @/lib/rich-text before @/lib/trpc in panels
    files = glob.glob('apps/web/src/pages/workflow/panels/*.tsx')
    for filepath in files:
        with open(filepath, 'r') as f:
            content = f.read()
            
        if "import { isRichTextEmpty } from '@/lib/rich-text';" in content and "import { trpc" in content:
            # We want isRichTextEmpty to be right before trpc.
            lines = content.split('\n')
            rich_idx = -1
            trpc_idx = -1
            for i, line in enumerate(lines):
                if line.startswith("import { isRichTextEmpty } from '@/lib/rich-text';"): rich_idx = i
                if line.startswith("import { trpc"): trpc_idx = i
            
            if rich_idx != -1 and trpc_idx != -1 and rich_idx > trpc_idx:
                l = lines.pop(rich_idx)
                # find where trpc is now, it might have shifted
                trpc_idx = -1
                for i, line in enumerate(lines):
                    if line.startswith("import { trpc"): trpc_idx = i
                lines.insert(trpc_idx, l)
                
                with open(filepath, 'w') as f:
                    f.write('\n'.join(lines))
                    
fix_imports_again()
print("Done fixing imports 2")
