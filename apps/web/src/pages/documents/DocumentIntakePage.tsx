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

import type { Control, UseFormSetValue, UseFormRegister, FieldErrors, Path } from 'react-hook-form';

import { buildIntakeFormSchema, type IntakeFormValues } from '@/lib/intake-schema';
import { SYSTEM_SET_METADATA_FIELDS } from '@/lib/system-set-metadata-fields';
import { trpc } from '@/lib/trpc';

interface SchemaPropertyDescriptor {
  type?: string | string[];
  enum?: (string | null)[];
  properties?: Record<string, SchemaPropertyDescriptor>;
  required?: string[];
  items?: SchemaPropertyDescriptor;
  default?: unknown;
}

interface BaseFieldProps {
  name: string;
  label: string;
  isRequired: boolean;
  control: Control<IntakeFormValues>;
  setValue: UseFormSetValue<IntakeFormValues>;
}
function SponsorsArrayField({
  name,
  prop,
  control,
  label,
  isRequired,
  setValue,
}: BaseFieldProps & { prop: SchemaPropertyDescriptor }) {
  const { fields, append, remove } = useFieldArray({ control, name: name as never });
  const { data: spMembers } = trpc.organization.listSpMembers.useQuery(undefined, {
    staleTime: Infinity,
  });

  return (
    <div className="space-y-4 border rounded-md p-4 bg-muted/10">
      <div className="flex justify-between items-center">
        <h4 className="font-medium text-sm">{label} {isRequired && <span className="text-danger-500">*</span>}</h4>
        <Button type="button" variant="outline" size="sm" onClick={() => append({ role: 'author' })}>
          Add Sponsor
        </Button>
      </div>
      {fields.length === 0 && <p className="text-sm text-muted-foreground">No sponsors added.</p>}
      {fields.map((field, index) => (
        <div key={field.id} className="relative space-y-4 border-t border-muted-foreground/20 pt-4 mt-4">
           <div className="flex justify-between items-center mb-2">
             <h5 className="text-xs font-semibold text-muted-foreground uppercase">Sponsor {index + 1}</h5>
             <Button type="button" variant="ghost" size="sm" className="h-6 text-xs text-danger-500 hover:text-danger-600" onClick={() => remove(index)}>Remove</Button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Member <span className="text-danger-500">*</span></Label>
               <Controller
                 name={`${name}.${index}.person_id` as Path<IntakeFormValues>}
                 control={control}
                 render={({ field: selectField }) => (
                   <Select 
                     onValueChange={(val) => {
                       selectField.onChange(val);
                       const member = spMembers?.find(m => m.employeeId === val);
                       if (member) {
                         setValue(`${name}.${index}.display_name` as Path<IntakeFormValues>, member.displayName, { shouldValidate: true });
                       }
                     }} 
                     value={(selectField.value as string) || ''}
                   >
                     <SelectTrigger>
                       <SelectValue placeholder="Select member" />
                     </SelectTrigger>
                     <SelectContent>
                       {spMembers?.map((member) => (
                         <SelectItem key={member.employeeId} value={member.employeeId}>
                           {member.displayName}
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 )}
               />
               <input type="hidden" {...control.register(`${name}.${index}.display_name` as Path<IntakeFormValues>)} />
             </div>
             
             <div className="space-y-2">
               <Label>Role <span className="text-danger-500">*</span></Label>
               <Controller
                 name={`${name}.${index}.role` as Path<IntakeFormValues>}
                 control={control}
                 render={({ field: roleField }) => (
                   <Select onValueChange={roleField.onChange} value={(roleField.value as string) || ''}>
                     <SelectTrigger>
                       <SelectValue placeholder="Select role" />
                     </SelectTrigger>
                     <SelectContent>
                       {(prop.items?.properties?.['role']?.enum || ['author', 'co_author']).map((opt: string | null) => {
                         if (opt === null) return null;
                         return (
                         <SelectItem key={opt} value={opt}>
                           {opt.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                         </SelectItem>
                         );
                       })}
                     </SelectContent>
                   </Select>
                 )}
               />
             </div>
           </div>
        </div>
      ))}
    </div>
  );
}

function MeasurePickerArrayField({
  name,
  control,
  label,
  isRequired,
}: Omit<BaseFieldProps, 'setValue'>) {
  const { data: documentTypes } = trpc.documents.documentTypes.useQuery(undefined, {
    staleTime: Infinity,
  });

  const measureTypeIds = documentTypes
    ?.filter(t => ['SP_RESOLUTION', 'SP_ORDINANCE', 'SP_APPROPRIATION_ORDINANCE'].includes(t.code))
    .map(t => t.id) || [];

  const { data: searchResult, isLoading } = trpc.documents.search.useQuery(
    {
      queryText: '',
      documentTypeIds: measureTypeIds,
      limit: 100,
    },
    {
      enabled: measureTypeIds.length > 0,
    }
  );

  return (
    <div className="space-y-4 border rounded-md p-4 bg-muted/10 mt-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium text-sm">{label} {isRequired && <span className="text-danger-500">*</span>}</h4>
      </div>
      <Controller
        name={name as Path<IntakeFormValues>}
        control={control}
        render={({ field }) => {
          const values = Array.isArray(field.value) ? field.value : [];
          return (
            <div className="space-y-4 mt-4">
              {values.length === 0 && <p className="text-sm text-muted-foreground">No measures selected.</p>}
              {values.map((v: string, idx: number) => (
                 <div key={idx} className="flex gap-2">
                   <div className="flex-1">
                     <Select
                       onValueChange={(newVal) => {
                         const next = [...values];
                         next[idx] = newVal;
                         field.onChange(next);
                       }}
                       value={v || ''}
                       disabled={isLoading}
                     >
                       <SelectTrigger>
                         <SelectValue placeholder="Select a measure..." />
                       </SelectTrigger>
                       <SelectContent>
                         {searchResult?.items.map((doc) => (
                           <SelectItem key={doc.documentId} value={doc.documentId}>
                             {doc.finalNumber || 'No Number'} - {doc.title}
                           </SelectItem>
                         ))}
                       </SelectContent>
                     </Select>
                   </div>
                   <Button type="button" variant="ghost" size="sm" className="text-danger-500 hover:text-danger-600 h-9" onClick={() => {
                     const next = values.filter((_, i) => i !== idx);
                     field.onChange(next);
                   }}>Remove</Button>
                 </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => field.onChange([...values, ''])}>
                Add Measure
              </Button>
            </div>
          );
        }}
      />
    </div>
  );
}

function DynamicArrayField({
  name,
  prop,
  control,
  register,
  label,
  isRequired,
  setValue,
}: BaseFieldProps & {
  prop: SchemaPropertyDescriptor;
  register: UseFormRegister<IntakeFormValues>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: name as never });
  
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
           {Object.entries(prop.items?.properties || {}).map(([subKey, subProp]) => {
              const subIsRequired = prop.items?.required?.includes(subKey);
              const subLabel = subKey.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              return (
                <DynamicField 
                  key={subKey} 
                  name={`${name}.${index}.${subKey}`} 
                  prop={subProp} 
                  control={control} 
                  register={register} 
                  label={subLabel} 
                  isRequired={!!subIsRequired} 
                  setValue={setValue}
                  errors={{} as FieldErrors<IntakeFormValues>}
                />
              );
           })}
        </div>
      ))}
    </div>
  );
}

function UserPickerField({
  name,
  control,
  label,
  isRequired,
  setValue,
}: BaseFieldProps) {
  const { data: users, isLoading } = trpc.iam.listAllUsers.useQuery(undefined, {
    staleTime: Infinity,
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={`meta-${name}`}>
        {label} {isRequired && <span className="text-danger-500">*</span>}
      </Label>
      <Controller
        name={name as Path<IntakeFormValues>}
        control={control}
        render={({ field }) => (
          <Select 
            onValueChange={(val) => {
              field.onChange(val);
              const user = users?.find(u => u.id === val);
              if (user) {
                // Try to set display name if the schema expects it
                const displayNameField = name.replace(/_user_id$/, '_display_name');
                setValue(displayNameField as Path<IntakeFormValues>, user.displayName, { shouldValidate: true, shouldDirty: true });
              }
            }} 
            value={(field.value as string) || ''}
            disabled={isLoading}
          >
            <SelectTrigger id={`meta-${name}`}>
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {users?.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

function OfficePickerField({
  name,
  control,
  label,
  isRequired,
}: Omit<BaseFieldProps, 'setValue'>) {
  const { data: offices, isLoading } = trpc.organization.listAllOffices.useQuery(undefined, {
    staleTime: Infinity,
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={`meta-${name}`}>
        {label} {isRequired && <span className="text-danger-500">*</span>}
      </Label>
      <Controller
        name={name as Path<IntakeFormValues>}
        control={control}
        render={({ field }) => (
          <Select onValueChange={field.onChange} value={(field.value as string) || ''} disabled={isLoading}>
            <SelectTrigger id={`meta-${name}`}>
              <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {offices?.map((office) => (
                <SelectItem key={office.id} value={office.id}>
                  {office.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </div>
  );
}

function DynamicField({
  name,
  prop,
  control,
  register,
  label,
  isRequired,
  setValue,
  errors,
}: BaseFieldProps & {
  prop: SchemaPropertyDescriptor;
  register: UseFormRegister<IntakeFormValues>;
  errors: FieldErrors<IntakeFormValues>;
}) {
  if (prop.enum) {
    return (
      <div className="space-y-2">
        <Label htmlFor={`meta-${name}`}>
          {label} {isRequired && <span className="text-danger-500">*</span>}
        </Label>
        <Controller
          name={name as Path<IntakeFormValues>}
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={(field.value as string) || ''}>
              <SelectTrigger id={`meta-${name}`}>
                <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {(prop.enum || []).map((opt: string | null) => {
                  if (opt === null) return null; // Or handle null if needed
                  return (
                    <SelectItem key={opt} value={opt}>
                      {opt.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        />
        {(() => {
          const fieldKey = name.split('.').pop() ?? name;
          const fieldError = errors?.metadata?.[fieldKey as keyof typeof errors.metadata];
          return fieldError && (
            <p className="text-destructive text-sm">{fieldError?.message as string}</p>
          );
        })()}
      </div>
    );
  }

  if (prop.type === 'boolean') {
    return (
      <div className="flex items-center space-x-2.5 py-1">
        <Controller
          name={name as Path<IntakeFormValues>}
          control={control}
          render={({ field }) => (
            <Checkbox
              id={`meta-${name}`}
              checked={field.value === true}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor={`meta-${name}`} className="text-sm font-medium text-text-primary cursor-pointer select-none">
          {label} {isRequired && <span className="text-danger-500">*</span>}
        </Label>
        {(() => {
          const fieldKey = name.split('.').pop() ?? name;
          const fieldError = errors?.metadata?.[fieldKey as keyof typeof errors.metadata];
          return fieldError && (
            <p className="text-destructive text-sm">{fieldError?.message as string}</p>
          );
        })()}
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
               isRequired={!!subIsRequired} 
               setValue={setValue}
               errors={errors}
             />
           );
        })}
      </div>
    );
  }

  if (prop.type === 'array' && prop.items?.type === 'object') {
    if (name === 'metadata.sponsors') {
      return (
        <SponsorsArrayField 
          name={name as Path<IntakeFormValues>} 
          prop={prop} 
          control={control} 
          label={label} 
          isRequired={isRequired} 
          setValue={setValue}
        />
      );
    }

    return (
      <DynamicArrayField 
        name={name as Path<IntakeFormValues>} 
        prop={prop} 
        control={control} 
        register={register} 
        label={label} 
        isRequired={isRequired} 
        setValue={setValue}
      />
    );
  }

  if (prop.type === 'array') {
    if (name === 'metadata.associated_measure_ids') {
      return (
        <MeasurePickerArrayField 
          name={name as Path<IntakeFormValues>} 
          control={control} 
          label={label} 
          isRequired={isRequired} 
        />
      );
    }
    return (
      <div className="space-y-2">
        <Label htmlFor={`meta-${name}`}>
          {label} (comma separated) {isRequired && <span className="text-danger-500">*</span>}
        </Label>
        <Input
          id={`meta-${name}`}
          {...register(name as Path<IntakeFormValues>)}
          placeholder="e.g. John Doe, Jane Smith"
        />
        {(() => {
          const fieldKey = name.split('.').pop() ?? name;
          const fieldError = errors?.metadata?.[fieldKey as keyof typeof errors.metadata];
          return fieldError && (
            <p className="text-destructive text-sm">{fieldError?.message as string}</p>
          );
        })()}
      </div>
    );
  }

  // Handle _user_id and _office_id properties
  const keyName = name.split('.').pop() || name;
  if (keyName.endsWith('_user_id')) {
    return (
      <UserPickerField 
        name={name as Path<IntakeFormValues>} 
        control={control} 
        label={label} 
        isRequired={isRequired} 
        setValue={setValue} 
      />
    );
  }
  
  if (keyName.endsWith('_office_id')) {
    return (
      <OfficePickerField 
        name={name as Path<IntakeFormValues>} 
        control={control} 
        label={label} 
        isRequired={isRequired} 
      />
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`meta-${name}`}>
        {label} {isRequired && <span className="text-danger-500">*</span>}
      </Label>
      <Input id={`meta-${name}`} {...register(name as Path<IntakeFormValues>)} />
      {(() => {
        const fieldKey = name.split('.').pop() ?? name;
        const fieldError = errors?.metadata?.[fieldKey as keyof typeof errors.metadata];
        return fieldError && (
          <p className="text-destructive text-sm">{fieldError?.message as string}</p>
        );
      })()}
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

  // Workaround for circular dependency: control -> useWatch -> selectedType -> resolver -> useForm -> control
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above; a typed alternative was not found without reintroducing the circular dependency this works around
  const intakeResolver = (values: Record<string, unknown>, context: unknown, options: any) => {
    const selectedType = documentTypes?.find((t) => t.id === values['documentTypeId']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
    return zodResolver(buildIntakeFormSchema(selectedType?.metadataSchema as Record<string, unknown> | null | undefined) as any)(values, context, options);
  };

  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<IntakeFormValues>({
    resolver: intakeResolver,
    defaultValues: {
      documentTypeId: '',
      title: '',
      metadata: {},
    },
  });

  const selectedDocumentTypeId = useWatch({ control, name: 'documentTypeId' });
  const selectedType = documentTypes?.find((t) => t.id === selectedDocumentTypeId);
  const metadataSchema = selectedType?.metadataSchema as {
    properties?: Record<string, SchemaPropertyDescriptor>;
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
      const cleanMetadata = { ...data.metadata } as Record<string, unknown>;

      const cleanRecursive = (
        schemaProps: Record<string, SchemaPropertyDescriptor> | undefined,
        obj: Record<string, unknown> | undefined,
      ) => {
        if (!schemaProps || !obj) return;
        for (const [key, prop] of Object.entries(schemaProps)) {
          if (prop.type === 'array' && typeof obj[key] === 'string') {
             // Split comma separated list
             obj[key] = (obj[key] as string)
               .split(',')
               .map((s: string) => s.trim())
               .filter(Boolean);
          } else if (prop.type === 'object' && prop.properties && typeof obj[key] === 'object') {
             cleanRecursive(prop.properties, obj[key] as Record<string, unknown>);
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
    <div className="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
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
                      const type = documentTypes?.find((t) => t.id === val);
                      const defaultMetadata: Record<string, unknown> = {};
                      const schema = type?.metadataSchema as {
                        properties?: Record<string, SchemaPropertyDescriptor>;
                      } | null | undefined;

                      const setDefaultsRecursive = (
                        schemaProps: Record<string, SchemaPropertyDescriptor> | undefined,
                        obj: Record<string, unknown>,
                      ) => {
                        if (!schemaProps) return;
                        for (const [k, p] of Object.entries(schemaProps)) {
                          if (
                            p.type === 'boolean' ||
                            (Array.isArray(p.type) && p.type.includes('boolean'))
                          ) {
                            obj[k] = p.default ?? false;
                          } else if (p.type === 'object' && p.properties) {
                            obj[k] = {};
                            setDefaultsRecursive(p.properties, obj[k] as Record<string, unknown>);
                          }
                        }
                      };

                      if (schema?.properties) {
                        setDefaultsRecursive(schema.properties, defaultMetadata);
                      }

                      setValue('metadata', defaultMetadata);
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
                {Object.entries(metadataSchema.properties)
                  .filter(([key]) => !SYSTEM_SET_METADATA_FIELDS.has(key))
                  .map(([key, prop]) => {
                  const isRequired = !!metadataSchema.required?.includes(key);
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
                      setValue={setValue}
                      errors={errors}
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
