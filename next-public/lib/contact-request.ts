import { z } from 'zod'

export const CONTACT_CATEGORIES = ['privacy', 'security', 'candidate_data', 'general'] as const
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]

export const contactRequestSchema = z.object({
  category: z.enum(CONTACT_CATEGORIES),
  email: z.string().email().max(320),
  subject: z.string().trim().max(160).optional(),
  candidate_reference: z.string().trim().max(500).optional(),
  message: z.string().trim().min(10).max(5000),
})

export type ContactRequestInput = z.infer<typeof contactRequestSchema>
