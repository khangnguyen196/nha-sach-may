import { z } from 'zod'
import { optionalMultilineText } from '@/lib/text-schema'
import { checkbox, integer, optionalInteger, optionalText, requiredText, resolveSlug } from '../schemas'

export const categoryFormSchema = z
  .object({
    name: requiredText(200, 'name'),
    name_en: optionalText(200, 'name'),
    slug: z.string().optional(),
    description: optionalMultilineText(2_000, 'description'),
    description_en: optionalMultilineText(2_000, 'description'),
    parent_id: optionalInteger('invalid', 1, Number.MAX_SAFE_INTEGER),
    sort_order: integer('sortOrder', -1_000, 1_000),
    is_active: checkbox,
  })
  .transform(({ slug, ...data }, ctx) => ({ ...data, slug: resolveSlug(slug, data.name, ctx) }))

export type CategoryFormInput = z.output<typeof categoryFormSchema>
