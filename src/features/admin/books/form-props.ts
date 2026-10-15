import 'server-only'
import { getTranslations } from 'next-intl/server'
import { placeholder } from '@/lib/template'
import { getAdminFormMessages } from '../form-messages'
import { AUTHOR_ROLES, BOOK_FORMATS, BOOK_LANGUAGES } from './schemas'

/** Chuỗi đã dịch cho các form ở trang sửa sách (client leaf nhận qua props) */
export async function getBookFormProps() {
  const [t, tCommon, messages, coverMessages] = await Promise.all([
    getTranslations('admin.books'),
    getTranslations('admin.common'),
    getAdminFormMessages(['SLUG_TAKEN']),
    getAdminFormMessages(['COVER_TOO_LARGE', 'COVER_INVALID']),
  ])
  return {
    messages,
    coverMessages,
    labels: {
      sections: {
        info: t('sections.info'),
        pricing: t('sections.pricing'),
        classification: t('sections.classification'),
        details: t('sections.details'),
        authors: t('sections.authors'),
      },
      fields: {
        title: t('fields.title'),
        subtitle: t('fields.subtitle'),
        slug: t('fields.slug'),
        slugHint: `${tCommon('slugHint')} ${tCommon('slugChangeHint')}`,
        description: t('fields.description'),
        descriptionEn: t('fields.descriptionEn'),
        descriptionEnHint: t('fields.descriptionEnHint'),
        isbn: t('fields.isbn'),
        price: t('fields.price'),
        originalPrice: t('fields.originalPrice'),
        originalPriceHint: t('fields.originalPriceHint'),
        stock: t('fields.stock'),
        category: t('fields.category'),
        selectCategory: t('fields.selectCategory'),
        categoryHint: t('fields.categoryHint'),
        publisher: t('fields.publisher'),
        noPublisher: t('fields.noPublisher'),
        publishedYear: t('fields.publishedYear'),
        pageCount: t('fields.pageCount'),
        format: t('fields.format'),
        language: t('fields.language'),
        weight: t('fields.weight'),
        dimensions: t('fields.dimensions'),
        dimensionsHint: t('fields.dimensionsHint'),
        featured: t('fields.featured'),
        featuredHint: t('fields.featuredHint'),
        hidden: tCommon('hidden'),
      },
      formats: Object.fromEntries(BOOK_FORMATS.map((format) => [format, t(`formats.${format}`)])),
      languages: Object.fromEntries(BOOK_LANGUAGES.map((language) => [language, t(`languages.${language}`)])),
      roles: Object.fromEntries(AUTHOR_ROLES.map((role) => [role, t(`roles.${role}`)])),
      authors: {
        // {n} điền ở client theo số dòng (lib/template.ts)
        author: t('authors.author', { n: placeholder('n') }),
        role: t('authors.role', { n: placeholder('n') }),
        noAuthor: t('authors.noAuthor'),
        addRow: t('authors.addRow'),
        hint: t('authors.hint'),
      },
      save: tCommon('save'),
      saving: tCommon('saving'),
      saved: tCommon('saved'),
    },
    coverLabels: {
      file: t('cover.file'),
      hint: t('cover.hint'),
      upload: t('cover.upload'),
      uploading: t('cover.uploading'),
      uploaded: t('cover.uploaded'),
    },
  }
}

export type BookFormLabels = Awaited<ReturnType<typeof getBookFormProps>>['labels']
export type CoverFormLabels = Awaited<ReturnType<typeof getBookFormProps>>['coverLabels']
