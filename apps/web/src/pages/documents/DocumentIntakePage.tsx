import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { useForm, Controller, useWatch, useFieldArray } from 'react-hook-form';
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
  CardFooter,
  Checkbox,
} from '@batac/ui';

import { IntakeFormSchema, type IntakeFormValues } from '@/lib/intake-schema';
import { trpc } from '@/lib/trpc';

function DynamicArrayField({ name, prop, control, register, label, isRequired }: any) {
  const { fields, append, remove } = useFieldArray({ control, name });
  
  return (
    <div className="space-y-4 border rounded-md p-4 bg-muted/10">
      <div className="flex justify-between items-center">
        <h4 className="font-medium text-sm">{label} {isRequired && <span className="text-danger-500">*</span>}</h4>
        <Button type="button" variant="outline" size="sm" onClick={() => append({})}>
          Add {label}
        </Button>
      </div>
      {fields.length === 0 && <p className="text-sm text-muted-foreground">No items added.</p>}
      {fields.map((field, index) => (
        <div key={field.id} className="relative space-y-4 border-t pt-4 mt-4">
           <div className="flex justify-between items-center mb-2">
             <h5 className="text-xs font-semibold text-muted-foreground uppercase">Item {index + 1}</h5>
             <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-danger-500 hover:text-danger-600" onClick={() => remove(index)}>Remove</Button>
           </div>
           {Object.entries(prop.items.properties || {}).map(([subKey, subProp]) => {
              const subIsRequired = prop.items.required?.includes(subKey);
              const subLabel = subKey.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              return (
                <DynamicField 
                  key={subKey} 
                  name={`${name}.${index}.${subKey}`} 
                  prop={subProp} 
                  control={control} 
                  register={register} 
                  label={subLabel} 
                  isRequired={subIsRequired} 
                />
              );
           })}
        </div>
      ))}
    </div>
  );
}

function DynamicField({ name, prop, control, register, label, isRequired }: any) {
  if (prop.type === 'boolean') {
    return (
      <div className="flex items-center space-x-2">
        <Controller
          name={name}
          control={control}
          render={({ field }) => (
            <Checkbox
              id={`meta-${name}`}
              checked={field.value === true}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor={`meta-${name}`} className="font-normal cursor-pointer">
          {label} {isRequired && <span className="text-danger-500">*</span>}
        </Label>
      </div>
    );
  }

  if (prop.type === 'object' && prop.properties) {
    return (
      <div className="space-y-4 border rounded-md p-4 bg-muted/10">
        <h4 className="font-medium text-sm">{label} {isRequired && <span className="text-danger-500">*</span>}</h4>
        {Object.entries(prop.properties).map(([subKey, subProp]) => {
           const subIsRequired = prop.required?.includes(subKey);
           const subLabel = subKey.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
           return (
             <DynamicField 
               key={subKey} 
               name={`${name}.${subKey}`} 
               prop={subProp} 
               control={control} 
               register={register} 
               label={subLabel} 
               isRequired={subIsRequired} 
             />
           );
        })}
      </div>
    );
  }

  if (prop.type === 'array' && prop.items?.type === 'object') {
    return (
      <DynamicArrayField 
        name={name} 
        prop={prop} 
        control={control} 
        register={register} 
        label={label} 
        isRequired={isRequired} 
      />
    );
  }

  if (prop.type === 'array') {
    return (
      <div className="space-y-2">
        <Label htmlFor={`meta-${name}`}>
          {label} (comma separated) {isRequired && <span className="text-danger-500">*</span>}
        </Label>
        <Input
          id={`meta-${name}`}
          {...register(name)}
          placeholder="e.g. John Doe, Jane Smith"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`meta-${name}`}>
        {label} {isRequired && <span className="text-danger-500">*</span>}
      </Label>
      <Input id={`meta-${name}`} {...register(name)} />
    </div>
  );
}

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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<IntakeFormValues>({
    resolver: zodResolver(IntakeFormSchema),
    defaultValues: {
      documentTypeId: '',
      title: '',
      metadata: {},
    },
  });

  const selectedDocumentTypeId = useWatch({ control, name: 'documentTypeId' });
  const selectedType = documentTypes?.find((t) => t.id === selectedDocumentTypeId);
  const metadataSchema = selectedType?.metadataSchema as {
    properties?: Record<string, any>;
    required?: string[];
  } | null | undefined;

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

    const mimeTypeCheck = AllowedMimeTypeSchema.safeParse(selected.type);
    if (!mimeTypeCheck.success) {
      setFile(null);
      setFileError('Invalid file type. Must be PDF, Word (.docx), Excel (.xlsx), JPEG, or PNG');
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

      // Clean metadata based on schema if array type is string
      const cleanMetadata = { ...data.metadata } as Record<string, any>;
      
      const cleanRecursive = (schemaProps: any, obj: any) => {
        if (!schemaProps || !obj) return;
        for (const [key, prop] of Object.entries(schemaProps) as [string, any][]) {
          if (prop.type === 'array' && typeof obj[key] === 'string') {
             // Split comma separated list
             obj[key] = obj[key]
               .split(',')
               .map((s: string) => s.trim())
               .filter(Boolean);
          } else if (prop.type === 'object' && prop.properties && typeof obj[key] === 'object') {
             cleanRecursive(prop.properties, obj[key]);
          }
        }
      };
      
      cleanRecursive(metadataSchema?.properties, cleanMetadata);

      // 1. Create document draft
      const { documentId } = await createDocument.mutateAsync({
        documentTypeId: data.documentTypeId,
        title: data.title,
        metadata: cleanMetadata,
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
    <div className="container mx-auto max-w-2xl py-8">
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
                  <Select
                    onValueChange={(val) => {
                      field.onChange(val);
                      setValue('metadata', {}); // Reset metadata on type change
                    }}
                    value={field.value}
                  >
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
                <p className="text-destructive text-sm">{errors.documentTypeId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register('title')} placeholder="Enter document title" />
              {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
            </div>

            {metadataSchema?.properties && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-sm font-semibold tracking-wider text-neutral-500 uppercase">
                  Additional Information
                </h3>
                {Object.entries(metadataSchema.properties).map(([key, prop]) => {
                  const isRequired = metadataSchema.required?.includes(key);
                  const label = key
                    .split('_')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');

                  return (
                    <DynamicField 
                      key={key} 
                      name={`metadata.${key}`} 
                      prop={prop} 
                      control={control} 
                      register={register} 
                      label={label} 
                      isRequired={isRequired} 
                    />
                  );
                })}
              </div>
            )}

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="file">File (PDF, JPEG, PNG, max 25MiB)</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {fileError && <p className="text-destructive text-sm">{fileError}</p>}
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
