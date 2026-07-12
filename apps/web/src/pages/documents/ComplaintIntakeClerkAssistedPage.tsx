import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { useForm } from 'react-hook-form';
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
  PageHeader,
} from '@batac/ui';

import { trpc } from '@/lib/trpc';


const ComplaintIntakeSchema = z.object({
  complainantName: z.string().min(1, 'Complainant name is required'),
  complainantAddress: z.string().optional(),
  complainantContact: z.string().optional(),
  subjectCategory: z.string().min(1, 'Subject category is required'),
  incidentNarrative: z.string().min(1, 'Incident narrative is required'),
  respondentName: z.string().optional(),
  respondentEmail: z.union([z.literal(''), z.string().email('Invalid email address')]).optional(),
  respondentPhone: z.string().optional(),
});

type ComplaintIntakeValues = z.infer<typeof ComplaintIntakeSchema>;

export function ComplaintIntakeClerkAssistedPage() {
  const navigate = useNavigate();
  const createComplaint = trpc.documents.createComplaintClerkAssisted.useMutation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ComplaintIntakeValues>({
    resolver: zodResolver(ComplaintIntakeSchema as any),
    defaultValues: {
      complainantName: '',
      complainantAddress: '',
      complainantContact: '',
      subjectCategory: '',
      incidentNarrative: '',
      respondentName: '',
      respondentEmail: '',
      respondentPhone: '',
    },
  });

  const onSubmit = async (data: ComplaintIntakeValues) => {
    try {
      const payload = {
        ...data,
        respondentEmail: data.respondentEmail || undefined, // send undefined if empty string
      };

      const result = await createComplaint.mutateAsync(payload);
      
      toast.success('Complaint logged successfully');
      navigate(`/complaints/${result.complaintId}`);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while logging the complaint');
    }
  };

  return (
    <div className="container max-w-3xl mx-auto py-8">
      <PageHeader 
        title="Log Citizen Complaint" 
        subtitle="Clerk-Assisted Intake" 
      />
      
      <Card className="mt-6">
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="text-lg">Complaint Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Complainant Section */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-neutral-500 uppercase tracking-wider">Complainant Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="complainantName">Full Name <span className="text-danger-500">*</span></Label>
                  <Input
                    id="complainantName"
                    {...register('complainantName')}
                    placeholder="e.g. Juan Dela Cruz"
                  />
                  {errors.complainantName && (
                    <p className="text-sm text-danger-500">{errors.complainantName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="complainantContact">Contact Number</Label>
                  <Input
                    id="complainantContact"
                    {...register('complainantContact')}
                    placeholder="e.g. 09123456789"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="complainantAddress">Address</Label>
                  <Input
                    id="complainantAddress"
                    {...register('complainantAddress')}
                    placeholder="Complete address"
                  />
                </div>
              </div>
            </div>

            {/* Respondent Section */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-sm text-neutral-500 uppercase tracking-wider">Respondent Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="respondentName">Respondent Name</Label>
                  <Input
                    id="respondentName"
                    {...register('respondentName')}
                    placeholder="e.g. Pedro Penduko or unknown"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="respondentEmail">Email Address</Label>
                  <Input
                    id="respondentEmail"
                    type="email"
                    {...register('respondentEmail')}
                    placeholder="Optional"
                  />
                  {errors.respondentEmail && (
                    <p className="text-sm text-danger-500">{errors.respondentEmail.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="respondentPhone">Contact Number</Label>
                  <Input
                    id="respondentPhone"
                    {...register('respondentPhone')}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            {/* Incident Section */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-sm text-neutral-500 uppercase tracking-wider">Incident Details</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subjectCategory">Subject / Category <span className="text-danger-500">*</span></Label>
                  <Input
                    id="subjectCategory"
                    {...register('subjectCategory')}
                    placeholder="e.g. Noise Disturbance, Illegal Parking"
                  />
                  {errors.subjectCategory && (
                    <p className="text-sm text-danger-500">{errors.subjectCategory.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incidentNarrative">Narrative <span className="text-danger-500">*</span></Label>
                  <Textarea
                    id="incidentNarrative"
                    {...register('incidentNarrative')}
                    placeholder="Detailed description of the complaint..."
                    className="min-h-[120px]"
                  />
                  {errors.incidentNarrative && (
                    <p className="text-sm text-danger-500">{errors.incidentNarrative.message}</p>
                  )}
                </div>
              </div>
            </div>
            
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t pt-4 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/complaints')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Complaint'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
