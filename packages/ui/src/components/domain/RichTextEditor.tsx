import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export interface RichTextEditorProps {
  /** Current content as sanitized HTML. Empty string or undefined renders a placeholder. */
  value: string;
  /** Called with the editor's current HTML content on every content change. */
  onChange: (html: string) => void;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** Disables editing; renders content read-only. Does not hide the toolbar — hide the whole component instead if a read-only view without a toolbar is needed. */
  disabled?: boolean;
  /** Minimum height of the editable area, as a Tailwind arbitrary-value class fragment, e.g. "200px". Default: "120px". */
  minHeight?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled = false,
  minHeight = '120px',
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        class: cn(
          'max-w-none focus:outline-none w-full p-3 [&_p]:m-0 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic',
          `min-h-[${minHeight}]`
        ),
      },
    },
  });

  // Sync value if changed from outside
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  if (!editor) {
    return null;
  }

  const isEmpty = editor.isEmpty;

  return (
    <div
      className={cn(
        'flex flex-col border border-border-default rounded-md overflow-hidden bg-surface-base',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border-default p-1 bg-neutral-50">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled || !editor.can().chain().focus().toggleBold().run()}
          className={cn(editor.isActive('bold') && 'bg-neutral-200')}
          aria-label="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled || !editor.can().chain().focus().toggleItalic().run()}
          className={cn(editor.isActive('italic') && 'bg-neutral-200')}
          aria-label="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled || !editor.can().chain().focus().toggleBulletList().run()}
          className={cn(editor.isActive('bulletList') && 'bg-neutral-200')}
          aria-label="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled || !editor.can().chain().focus().toggleOrderedList().run()}
          className={cn(editor.isActive('orderedList') && 'bg-neutral-200')}
          aria-label="Ordered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative flex-grow">
        {isEmpty && placeholder && !disabled && (
          <div className="pointer-events-none absolute left-3 top-3 text-sm text-text-muted">
            {placeholder}
          </div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
