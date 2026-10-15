import { z } from 'zod'
import { optionalMultilineText } from '@/lib/text-schema'
import { requiredText, resolveSlug } from '../schemas'

export const authorFormSchema = z
  .object({
    name: requiredText(200, 'name'),
    slug: z.string().optional(),
    bio: optionalMultilineText(10_000, 'description'),
    bio_en: optionalMultilineText(10_000, 'description'),
  })
  .transform(({ slug, ...data }, ctx) => ({ ...data, slug: resolveSlug(slug, data.name, ctx) }))
