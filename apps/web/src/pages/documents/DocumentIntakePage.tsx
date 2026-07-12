import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { AllowedMimeTypeSchema } from '@batac/shared';
import { 
  Button, 
  Input, 
  Label, 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter
} from '@batac/ui';

import { IntakeFormSchema, type IntakeFormValues } from '@/lib/intake-schema';
import { trpc } from '@/lib/trpc';



export default function DocumentIntakePage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: documentTypes } = trpc.documents.documentTypes.useQuery();
  const createDocument = trpc.documents.create.useMutation();
  const requestUploadUrl = trpc.documents.requestUploadUrl.useMutation();
  const confirmUpload = trpc.documents.confirmUpload.useMutation();

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IntakeFormValues>({
    resolver: zodResolver(IntakeFormSchema),
    defaultValues: {
      documentTypeId: '',
      title: '',
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      setFileError('File is required');
      return;
    }

    const MAX_SIZE = 26214400; // 25 MiB
    if (selected.size > MAX_SIZE) {
      setFile(null);
      setFileError('File exceeds 25 MiB limit');
      return;
    }

    // TODO: validTypes only lists 3 of the 5 MIME types AllowedMimeTypeSchema actually accepts (missing Office document types)
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!validTypes.includes(selected.type)) {
      setFile(null);
      setFileError('Invalid file type. Must be PDF, JPEG, or PNG');
      return;
    }

    setFile(selected);
    setFileError(null);
  };

  const onSubmit = async (data: IntakeFormValues) => {
    if (!file) {
      setFileError('File is required');
      return;
    }

    const mimeTypeCheck = AllowedMimeTypeSchema.safeParse(file.type);
    if (!mimeTypeCheck.success) {
      setFileError('Unsupported file type');
      return;
    }

    try {
      setIsUploading(true);

      // 1. Create document draft
      const { documentId } = await createDocument.mutateAsync({
        documentTypeId: data.documentTypeId,
        title: data.title,
        metadata: {},
      });

      // 2. Request upload URL
      const { uploadUrl, s3Key } = await requestUploadUrl.mutateAsync({
        documentId,
        mimeType: mimeTypeCheck.data,
      });

      // 3. Upload to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // 4. Confirm upload
      await confirmUpload.mutateAsync({
        documentId,
        s3Key,
        originalFilename: file.name,
        mimeType: mimeTypeCheck.data,
        fileSizeBytes: file.size,
      });

      toast.success('Document created successfully');
      navigate(`/documents/${documentId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'An error occurred during upload');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Intake New Document</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="documentTypeId">Document Type</Label>
              <Controller
                name="documentTypeId"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="documentTypeId">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypes?.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.documentTypeId && (
                <p className="text-sm text-destructive">{errors.documentTypeId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                {...register('title')}
                placeholder="Enter document title"
              />
              {errors.title && (
                <p className="text-sm text-destructive">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">File (PDF, JPEG, PNG, max 25MiB)</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {fileError && (
                <p className="text-sm text-destructive">{fileError}</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/documents')}
              disabled={isSubmitting || isUploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || isUploading || !file || !!fileError}>
              {isUploading ? 'Uploading...' : 'Submit'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
