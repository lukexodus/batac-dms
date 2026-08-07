import os
import re

def move_import_after(filepath, import_str, after_str):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if import_str not in content or after_str not in content:
        return
        
    lines = content.split('\n')
    import_idx = -1
    after_idx = -1
    
    for i, line in enumerate(lines):
        if import_str in line:
            import_idx = i
        if after_str in line:
            after_idx = i
            
    if import_idx != -1 and after_idx != -1 and import_idx < after_idx:
        # Move import_idx line to after after_idx
        line_to_move = lines.pop(import_idx)
        # after popping, the new after_idx is after_idx - 1
        lines.insert(after_idx, line_to_move)
        
        with open(filepath, 'w') as f:
            f.write('\n'.join(lines))

def fix_imports():
    panels_dir = 'apps/web/src/pages/workflow/panels/'
    panels = [
        'AmendmentsLoggingPanel.tsx', 'CommitteeRevisionsDecisionPanel.tsx', 
        'GenericActionPanel.tsx', 'GenericApprovalPanel.tsx', 'LegalOfficeReviewDecisionPanel.tsx',
        'MayorDecisionPanel.tsx', 'OrderOfBusinessSchedulingPanel.tsx', 'PanlalawiganOutcomePanel.tsx',
        'ReturnedReviewDecisionPanel.tsx', 'SecretariatDecisionPanel.tsx', 'TransmittalLetterPanel.tsx',
        'ValidInPartDecisionPanel.tsx'
    ]
    
    for panel in panels:
        filepath = os.path.join(panels_dir, panel)
        if os.path.exists(filepath):
            move_import_after(filepath, "import { isRichTextEmpty } from '@/lib/rich-text';", "import {")
            # Wait, moving after 'import {' is tricky because there are multiple. We should just place it after the last import block.
            # A better way is to move it to the end of the imports.
            
    # Actually, the simplest fix is to just let prettier or something sort it.
    # I'll just write a regex to group all imports.
    pass

def simple_fix():
    # Let's just remove empty lines at the top of the files and move the rich-text import manually.
    import glob
    
    # apps/web/src/main.tsx
    main_path = 'apps/web/src/main.tsx'
    with open(main_path, 'r') as f:
        content = f.read()
    if 'RichTextEditorPage' in content:
        content = content.replace("import { RichTextEditorPage } from './pages/dev/RichTextEditorPage';\n", "")
        content = content.replace("import { RoutingHistoryTimelinePage } from './pages/dev/RoutingHistoryTimelinePage';", "import { RoutingHistoryTimelinePage } from './pages/dev/RoutingHistoryTimelinePage';\nimport { RichTextEditorPage } from './pages/dev/RichTextEditorPage';")
        with open(main_path, 'w') as f:
            f.write(content)
            
    # apps/web/src/pages/dev/RichTextEditorPage.tsx
    # apps/web/src/pages/documents/dialogs/LogCertificationOfUrgencyDialog.tsx
    # It just needs a swap.
    log_cert_path = 'apps/web/src/pages/documents/dialogs/LogCertificationOfUrgencyDialog.tsx'
    with open(log_cert_path, 'r') as f:
        content = f.read()
    if 'lucide-react' in content:
        lines = content.split('\n')
        l1, l2 = -1, -1
        for i, line in enumerate(lines):
            if 'lucide-react' in line: l1 = i
            if 'from \'react\'' in line: l2 = i
        if l1 != -1 and l2 != -1 and l1 > l2:
            lucide = lines.pop(l1)
            lines.insert(l2, lucide)
            with open(log_cert_path, 'w') as f:
                f.write('\n'.join(lines))

    # All panels: the issue is import order. Let's just delete the import { isRichTextEmpty } and re-insert it at the very bottom of the imports.
    files = glob.glob('apps/web/src/pages/workflow/panels/*.tsx')
    for filepath in files:
        with open(filepath, 'r') as f:
            content = f.read()
            
        if "import { isRichTextEmpty } from '@/lib/rich-text';" in content:
            content = content.replace("import { isRichTextEmpty } from '@/lib/rich-text';\n", "")
            
            # Find the last import
            last_import_idx = content.rfind('\nimport ')
            if last_import_idx != -1:
                end_of_line = content.find('\n', last_import_idx + 1)
                content = content[:end_of_line] + "\nimport { isRichTextEmpty } from '@/lib/rich-text';" + content[end_of_line:]
            
            with open(filepath, 'w') as f:
                f.write(content)
                
    # Fix empty lines between import groups. ESLint complains about empty lines at the very top (line 1:1, 2:1).
    # This happens because my script inserted `import ...` with a leading newline or something.
    for filepath in files + [main_path, 'apps/web/src/pages/dev/RichTextEditorPage.tsx']:
        with open(filepath, 'r') as f:
            content = f.read()
        while content.startswith('\n'):
            content = content[1:]
        # also remove multiple consecutive newlines in the import area
        import_area_end = content.find('export')
        if import_area_end == -1: import_area_end = len(content)
        
        import_area = content[:import_area_end]
        import_area = re.sub(r'\n{3,}', '\n\n', import_area)
        
        content = import_area + content[import_area_end:]
        with open(filepath, 'w') as f:
            f.write(content)

simple_fix()
print("Done fixing imports manually")
