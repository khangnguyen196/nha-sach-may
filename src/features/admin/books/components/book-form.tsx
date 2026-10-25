'use client'

import { PlusIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { CheckboxField } from '@/components/admin/checkbox-field'
import { Button } from '@/components/ui/button'
import { FormAlert, SelectField, TextAreaField, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { fillTemplate } from '@/lib/template'
import { useFormAction } from '@/lib/use-form-action'
import type { CategoryGroup } from '../../categories/tree'
import { WarningLabelsField } from '../../warnings/components/warning-labels-field'
import type { BookFormLabels } from '../form-props'
import type { AdminBook } from '../queries'
import { AUTHOR_ROLES, BOOK_FORMATS, BOOK_LANGUAGES, MAX_AUTHOR_ROWS } from '../schemas'

type Option = { id: number; name: string }

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: BookFormLabels
  book: AdminBook
  categoryGroups: CategoryGroup[]
  publishers: Option[]
  authors: Option[]
}

const numberInput = { type: 'text', inputMode: 'numeric', autoComplete: 'off' } as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-5 rounded-lg border bg-surface p-5 md:p-6">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  )
}

const text = (value: string | number | null) => (value === null ? '' : String(value))

export function BookForm({ action, messages, labels, book, categoryGroups, publishers, authors }: Props) {
  const { state, formProps, pending, ready, formError, quietError, fieldError } = useFormAction(action, messages)
  // Luôn có thêm một dòng trống (thêm được một tác giả mà không cần bấm "Thêm dòng"); "Thêm dòng" thêm dòng trống nữa
  const [rowCount, setRowCount] = useState(book.book_authors.length + 1)
  const label = (template: string, n: number) => fillTemplate(template, { n })

  return (
    <form {...formProps} noValidate className="grid gap-6">
      {formError && <FormAlert quiet={quietError}>{formError}</FormAlert>}

      <Section title={labels.sections.info}>
        <TextField
          name="title"
          label={labels.fields.title}
          defaultValue={book.title}
          maxLength={300}
          required
          error={fieldError('title')}
        />
        <TextField
          name="subtitle"
          label={labels.fields.subtitle}
          defaultValue={text(book.subtitle)}
          maxLength={300}
          error={fieldError('subtitle')}
        />
        <TextField
          name="slug"
          label={labels.fields.slug}
          defaultValue={book.slug}
          hint={labels.fields.slugHint}
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          error={fieldError('slug')}
        />
        <TextAreaField
          name="description"
          label={labels.fields.description}
          defaultValue={text(book.description)}
          rows={8}
          maxLength={10_000}
          error={fieldError('description')}
        />
        <TextAreaField
          name="description_en"
          label={labels.fields.descriptionEn}
          defaultValue={text(book.description_en)}
          hint={labels.fields.descriptionEnHint}
          rows={6}
          maxLength={10_000}
          lang="en"
          error={fieldError('description_en')}
        />
      </Section>

      <Section title={labels.sections.pricing}>
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            {...numberInput}
            name="price"
            label={labels.fields.price}
            defaultValue={book.price}
            required
            error={fieldError('price')}
          />
          <TextField
            {...numberInput}
            name="original_price"
            label={labels.fields.originalPrice}
            defaultValue={text(book.original_price)}
            hint={labels.fields.originalPriceHint}
            error={fieldError('original_price')}
          />
          <TextField
            {...numberInput}
            name="stock"
            label={labels.fields.stock}
            defaultValue={book.stock}
            required
            error={fieldError('stock')}
          />
        </div>
      </Section>

      <Section title={labels.sections.classification}>
        <SelectField
          name="category_id"
          label={labels.fields.category}
          defaultValue={text(book.category_id)}
          hint={labels.fields.categoryHint}
          required
          error={fieldError('category_id')}
        >
          <option value="">{labels.fields.selectCategory}</option>
          {categoryGroups.map((group) => {
            const options = group.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.hidden ? `${option.name} (${labels.fields.hidden})` : option.name}
              </option>
            ))
            return group.label ? (
              <optgroup key={group.label} label={group.label}>
                {options}
              </optgroup>
            ) : (
              options
            )
          })}
        </SelectField>
        <div className="grid gap-5 sm:grid-cols-3">
          <SelectField
            name="publisher_id"
            label={labels.fields.publisher}
            defaultValue={text(book.publisher_id)}
            error={fieldError('publisher_id')}
          >
            <option value="">{labels.fields.noPublisher}</option>
            {publishers.map((publisher) => (
              <option key={publisher.id} value={publisher.id}>
                {publisher.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            name="language"
            label={labels.fields.language}
            defaultValue={book.language}
            error={fieldError('language')}
          >
            {BOOK_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {labels.languages[language] ?? language}
              </option>
            ))}
          </SelectField>
          <SelectField name="format" label={labels.fields.format} defaultValue={book.format} error={fieldError('format')}>
            {BOOK_FORMATS.map((format) => (
              <option key={format} value={format}>
                {labels.formats[format] ?? format}
              </option>
            ))}
          </SelectField>
        </div>
        <CheckboxField
          name="is_featured"
          label={labels.fields.featured}
          hint={labels.fields.featuredHint}
          defaultChecked={book.is_featured}
        />
      </Section>

      <Section title={labels.sections.warnings}>
        <WarningLabelsField
          name="content_warnings"
          legend={labels.fields.warningsLegend}
          hint={labels.fields.warningsHint}
          options={labels.warningOptions}
          defaultValue={book.content_warnings}
          error={fieldError('content_warnings')}
        />
        {/* Nhãn lúc mở form: server chỉ ghi nhãn khi admin đổi (không đè nhãn vừa duyệt ở tab khác) */}
        {book.content_warnings.map((label) => (
          <input key={label} type="hidden" name="content_warnings_before" value={label} />
        ))}
      </Section>

      <Section title={labels.sections.authors}>
        <p className="text-sm text-muted-foreground">{labels.authors.hint}</p>
        <div className="grid gap-4">
          {Array.from({ length: rowCount }, (_, index) => {
            const row = book.book_authors[index]
            return (
              <div key={index} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <SelectField
                  name="author_id"
                  idPrefix={`author-${index}`}
                  label={label(labels.authors.author, index + 1)}
                  defaultValue={text(row?.author_id ?? null)}
                >
                  <option value="">{labels.authors.noAuthor}</option>
                  {authors.map((author) => (
                    <option key={author.id} value={author.id}>
                      {author.name}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  name="author_role"
                  idPrefix={`author-${index}`}
                  label={label(labels.authors.role, index + 1)}
                  defaultValue={row?.role ?? 'author'}
                >
                  {AUTHOR_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {labels.roles[role] ?? role}
                    </option>
                  ))}
                </SelectField>
              </div>
            )
          })}
        </div>
        {fieldError('authors') && <p className="text-sm text-destructive">{fieldError('authors')}</p>}
        {rowCount < MAX_AUTHOR_ROWS && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 justify-self-start px-4"
            onClick={() => setRowCount((count) => Math.min(count + 1, MAX_AUTHOR_ROWS))}
          >
            <PlusIcon aria-hidden />
            {labels.authors.addRow}
          </Button>
        )}
      </Section>

      <Section title={labels.sections.details}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <TextField
            name="isbn"
            label={labels.fields.isbn}
            defaultValue={text(book.isbn)}
            maxLength={20}
            autoComplete="off"
            error={fieldError('isbn')}
          />
          <TextField
            {...numberInput}
            name="published_year"
            label={labels.fields.publishedYear}
            defaultValue={text(book.published_year)}
            error={fieldError('published_year')}
          />
          <TextField
            {...numberInput}
            name="page_count"
            label={labels.fields.pageCount}
            defaultValue={text(book.page_count)}
            error={fieldError('page_count')}
          />
          <TextField
            {...numberInput}
            name="weight_grams"
            label={labels.fields.weight}
            defaultValue={text(book.weight_grams)}
            error={fieldError('weight_grams')}
          />
          <TextField
            name="dimensions"
            label={labels.fields.dimensions}
            defaultValue={text(book.dimensions)}
            hint={labels.fields.dimensionsHint}
            maxLength={50}
            error={fieldError('dimensions')}
          />
        </div>
      </Section>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pending={pending} ready={ready} pendingLabel={labels.saving} size="lg" className="h-11 px-5">
          {labels.save}
        </SubmitButton>
        <p role="status" className="text-sm text-success">
          {state?.ok && !pending ? labels.saved : ''}
        </p>
      </div>
    </form>
  )
}
