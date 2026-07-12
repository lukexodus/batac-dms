import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Printer } from 'lucide-react';
import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@batac/ui';

import { PrintableFormView } from './PrintableFormView';

import { trpc } from '@/lib/trpc';


const DocumentRequestSchema = z.object({
  requesterName: z.string().min(1, 'Requester name is required'),
  requesterContact: z.string().optional(),
  documentsRequested: z
    .array(
      z.object({
        documentTitle: z.string().min(1, 'Document title is required'),
        documentNumber: z.string().optional(),
      })
    )
    .min(1, 'At least one document is required'),
  purpose: z.string().max(512).optional(),
});

type DocumentRequestFormValues = z.infer<typeof DocumentRequestSchema>;

export function DocumentRequestIntakeClerkAssistedPage() {
  const navigate = useNavigate();
  const [showPrintView, setShowPrintView] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  const createMutation =
    trpc.documents.createDocumentRequestClerkAssisted.useMutation();

  const printableFormData = trpc.documents.generatePrintableForm.useQuery(
    { requestId: createdRequestId! },
    { enabled: !!createdRequestId && showPrintView }
  );

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DocumentRequestFormValues>({
    resolver: zodResolver(DocumentRequestSchema),
    defaultValues: {
      requesterName: '',
      requesterContact: '',
      documentsRequested: [{ documentTitle: '', documentNumber: '' }],
      purpose: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'documentsRequested',
  });

  const onSubmit = async (data: DocumentRequestFormValues) => {
    try {
      const { requestId } = await createMutation.mutateAsync({
        requesterName: data.requesterName,
        requesterContact: data.requesterContact || undefined,
        documentsRequested: data.documentsRequested,
        purpose: data.purpose || undefined,
      });

      toast.success('Document request created successfully');
      navigate(`/document-requests/${requestId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create document request');
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-8">
      {showPrintView && createdRequestId ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between no-print">
            <h2 className="text-lg font-semibold">Print Preview</h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowPrintView(false)}
              >
                Back to Form
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
          {printableFormData.data && (
            <PrintableFormView data={printableFormData.data} />
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>New Document Request (Clerk-Assisted)</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="requesterName">Requester Name *</Label>
                <Input
                  id="requesterName"
                  {...register('requesterName')}
                  placeholder="Enter requester's full name"
                />
                {errors.requesterName && (
                  <p className="text-sm text-destructive">
                    {errors.requesterName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="requesterContact">Contact Number</Label>
                <Input
                  id="requesterContact"
                  {...register('requesterContact')}
                  placeholder="Optional contact number"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Documents Requested *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      append({ documentTitle: '', documentNumber: '' })
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Document
                  </Button>
                </div>

                {errors.documentsRequested?.message && (
                  <p className="text-sm text-destructive">
                    {errors.documentsRequested.message}
                  </p>
                )}

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-start gap-2 rounded-md border p-3"
                    >
                      <div className="flex-1 grid grid-cols-[1fr_auto] gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Document Title *
                          </Label>
                          <Input
                            {...register(
                              `documentsRequested.${index}.documentTitle`
                            )}
                            placeholder="e.g., Barangay Clearance"
                          />
                          {errors.documentsRequested?.[index]
                            ?.documentTitle && (
                            <p className="text-xs text-destructive">
                              {
                                errors.documentsRequested[index]
                                  ?.documentTitle?.message
                              }
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Document No.
                          </Label>
                          <Input
                            {...register(
                              `documentsRequested.${index}.documentNumber`
                            )}
                            placeholder="Optional"
                            className="w-36"
                          />
                        </div>
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-5 text-destructive hover:text-destructive"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purpose">Purpose</Label>
                <Textarea
                  id="purpose"
                  {...register('purpose')}
                  placeholder="State the purpose of the request (max 512 characters)"
                  rows={3}
                />
                {errors.purpose && (
                  <p className="text-sm text-destructive">
                    {errors.purpose.message}
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/document-requests')}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Request'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </div>
  );
}
