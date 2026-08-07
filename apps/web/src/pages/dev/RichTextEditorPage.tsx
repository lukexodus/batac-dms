import React, { useState } from 'react';

import { RichTextEditor, Card, CardHeader, CardTitle, CardContent, Button } from '@batac/ui';

import { isRichTextEmpty } from '@/lib/rich-text';

export function RichTextEditorPage() {
  const [content, setContent] = useState('');
  const [submittedContent, setSubmittedContent] = useState<string | null>(null);

  const handleSubmit = () => {
    setSubmittedContent(content);
  };

  const isEmpty = isRichTextEmpty(content);

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">RichTextEditor Component</h1>
        <p className="text-muted-foreground">
          Tier 3 domain component for rich text editing using TipTap.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interactive Example</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Write something amazing..."
          />
          
          <div className="flex items-center gap-4">
            <Button onClick={handleSubmit} disabled={isEmpty}>
              Submit
            </Button>
            <span className="text-sm text-muted-foreground">
              Status: {isEmpty ? 'Empty (Submit Disabled)' : 'Has Content'}
            </span>
          </div>
        </CardContent>
      </Card>

      {submittedContent !== null && (
        <Card>
          <CardHeader>
            <CardTitle>Submitted Content Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-4 font-mono text-sm">
              {submittedContent || '<Empty>'}
            </div>
            
            <h3 className="text-lg font-medium mt-4">Rendered (dangerouslySetInnerHTML)</h3>
            <div 
              className="prose prose-sm max-w-none border rounded-md p-4 bg-white"
              dangerouslySetInnerHTML={{ __html: submittedContent }} 
            />
          </CardContent>
        </Card>
      )}

      <Card>
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
}
