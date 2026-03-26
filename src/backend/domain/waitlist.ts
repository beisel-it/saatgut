import { z } from 'zod'

export const interestAreas = [
  'Growing food at home',
  'Learning what to plant',
  'Getting updates when Saatgut launches',
] as const

export const waitlistSubmissionInputSchema = z.object({
  email: z.email(),
  interestArea: z.enum(interestAreas),
})

export const waitlistSubmissionSchema = waitlistSubmissionInputSchema.extend({
  id: z.number().int().positive(),
  createdAt: z.string().datetime(),
})

export type WaitlistSubmissionInput = z.infer<typeof waitlistSubmissionInputSchema>
export type WaitlistSubmission = z.infer<typeof waitlistSubmissionSchema>
