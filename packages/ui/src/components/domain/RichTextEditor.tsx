import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Underline, Strikethrough, Heading3, Heading4, Quote, Minus, Link, Undo2, Redo2 } from 'lucide-react';
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
          'max-w-none focus:outline-none w-full p-3 [&_p]:m-0 [&_p+p]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_em]:italic [&_u]:underline [&_s]:line-through [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_h4]:text-base [&_h4]:font-semibold [&_h4]:mt-2 [&_h4]:mb-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border-default [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-text-muted [&_a]:underline [&_a]:text-text-link [&_a]:cursor-pointer [&_hr]:my-3 [&_hr]:border-border-default',
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
      <div role="toolbar" aria-label="Formatting toolbar" className="flex flex-wrap items-center gap-1 border-b border-border-default p-1 bg-neutral-50">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled || !editor.can().chain().focus().toggleBold().run()}
          className={cn(editor.isActive('bold') && 'bg-neutral-200')}
          aria-label="Bold"
          aria-pressed={editor.isActive('bold')}
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
          aria-pressed={editor.isActive('italic')}
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
          aria-pressed={editor.isActive('bulletList')}
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
          aria-pressed={editor.isActive('orderedList')}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={disabled || !editor.can().chain().focus().toggleUnderline().run()}
          className={cn(editor.isActive('underline') && 'bg-neutral-200')}
          aria-label="Underline"
          aria-pressed={editor.isActive('underline')}
        >
          <Underline className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={disabled || !editor.can().chain().focus().toggleStrike().run()}
          className={cn(editor.isActive('strike') && 'bg-neutral-200')}
          aria-label="Strikethrough"
          aria-pressed={editor.isActive('strike')}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={disabled || !editor.can().chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(editor.isActive('heading', { level: 3 }) && 'bg-neutral-200')}
          aria-label="Heading 3"
          aria-pressed={editor.isActive('heading', { level: 3 })}
        >
          <Heading3 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          disabled={disabled || !editor.can().chain().focus().toggleHeading({ level: 4 }).run()}
          className={cn(editor.isActive('heading', { level: 4 }) && 'bg-neutral-200')}
          aria-label="Heading 4"
          aria-pressed={editor.isActive('heading', { level: 4 })}
        >
          <Heading4 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={disabled || !editor.can().chain().focus().toggleBlockquote().run()}
          className={cn(editor.isActive('blockquote') && 'bg-neutral-200')}
          aria-label="Blockquote"
          aria-pressed={editor.isActive('blockquote')}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          disabled={disabled || !editor.can().chain().focus().setHorizontalRule().run()}
          aria-label="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
            } else {
              const url = window.prompt('Enter URL:');
              if (url) {
                editor.chain().focus().setLink({ href: url }).run();
              }
            }
          }}
          disabled={disabled}
          className={cn(editor.isActive('link') && 'bg-neutral-200')}
          aria-label="Link"
          aria-pressed={editor.isActive('link')}
        >
          <Link className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().chain().focus().undo().run()}
          aria-label="Undo"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().chain().focus().redo().run()}
          aria-label="Redo"
        >
          <Redo2 className="h-4 w-4" />
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
