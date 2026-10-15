'use client'

import { useRef, useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import { FormAlert, SelectField, TextField } from '@/components/ui/field'
import { SubmitButton } from '@/components/ui/submit-button'
import { Link } from '@/i18n/navigation'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { useFormAction } from '@/lib/use-form-action'
import type { DivisionOption } from '../divisions'

type Labels = {
  recipientName: string
  phone: string
  province: string
  ward: string
  street: string
  selectProvince: string
  selectWard: string
  selectProvinceFirst: string
  loadingWards: string
  wardsError: string
  save: string
  pending: string
  cancel: string
}

type Initial = {
  recipientName: string
  phone: string
  street: string
  provinceCode: string
  wardCode: string
  /** Phường của tỉnh đang chọn, server tính sẵn → form sửa không cần gọi API lúc mở */
  wards: DivisionOption[]
}

type Props = {
  action: (prev: Result<null> | null, formData: FormData) => Promise<Result<null>>
  messages: FormMessages
  labels: Labels
  locale: string
  provinces: DivisionOption[]
  initial: Initial
}

type WardsStatus = 'idle' | 'loading' | 'error'

function isOptionList(value: unknown): value is DivisionOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        typeof Reflect.get(item, 'code') === 'string' &&
        typeof Reflect.get(item, 'label') === 'string',
    )
  )
}

export function AddressForm({ action, messages, labels, locale, provinces, initial }: Props) {
  const { formProps, pending, formError, quietError, fieldError } = useFormAction(action, messages)
  const [provinceCode, setProvinceCode] = useState(initial.provinceCode)
  const [wardCode, setWardCode] = useState(initial.wardCode)
  const [wards, setWards] = useState(initial.wards)
  const [wardsStatus, setWardsStatus] = useState<WardsStatus>('idle')
  const request = useRef<AbortController | null>(null)

  // Danh sách phường nạp theo tỉnh (34 tỉnh, ~100 phường/tỉnh): không nhúng cả 3.321 dòng vào trang
  async function changeProvince(code: string) {
    request.current?.abort()
    setProvinceCode(code)
    setWardCode('')
    setWards([])
    if (!code) {
      setWardsStatus('idle')
      return
    }

    const controller = new AbortController()
    request.current = controller
    setWardsStatus('loading')
    try {
      const params = new URLSearchParams({ locale })
      const response = await fetch(`/api/divisions/${encodeURIComponent(code)}?${params}`, {
        signal: controller.signal,
      })
      const body: unknown = await response.json()
      const data = typeof body === 'object' && body !== null ? Reflect.get(body, 'data') : undefined
      if (!response.ok || !isOptionList(data)) throw new Error(`divisions ${response.status}`)
      setWards(data)
      setWardsStatus('idle')
    } catch {
      if (!controller.signal.aborted) setWardsStatus('error')
    }
  }

  const wardPlaceholder = !provinceCode
    ? labels.selectProvinceFirst
    : wardsStatus === 'loading'
      ? labels.loadingWards
      : labels.selectWard

  return (
    <form {...formProps} noValidate className="grid gap-5">
      {formError && <FormAlert quiet={quietError}>{formError}</FormAlert>}
      <TextField
        name="recipient_name"
        label={labels.recipientName}
        defaultValue={initial.recipientName}
        autoComplete="name"
        maxLength={100}
        required
        error={fieldError('recipient_name')}
      />
      <TextField
        name="phone"
        type="tel"
        inputMode="tel"
        label={labels.phone}
        defaultValue={initial.phone}
        autoComplete="tel"
        maxLength={20}
        required
        error={fieldError('phone')}
      />
      <SelectField
        name="province"
        label={labels.province}
        value={provinceCode}
        onChange={(event) => changeProvince(event.target.value)}
        required
        error={fieldError('province')}
      >
        <option value="">{labels.selectProvince}</option>
        {provinces.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        name="ward"
        label={labels.ward}
        value={wardCode}
        onChange={(event) => setWardCode(event.target.value)}
        disabled={!provinceCode || wardsStatus === 'loading'}
        aria-busy={wardsStatus === 'loading' || undefined}
        required
        error={wardsStatus === 'error' ? labels.wardsError : fieldError('ward')}
      >
        <option value="">{wardPlaceholder}</option>
        {wards.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <TextField
        name="street"
        label={labels.street}
        defaultValue={initial.street}
        autoComplete="address-line1"
        maxLength={200}
        required
        error={fieldError('street')}
      />
      <div className="flex flex-wrap gap-3 pt-2">
        <SubmitButton pending={pending} pendingLabel={labels.pending} size="lg" className="h-11 px-5">
          {labels.save}
        </SubmitButton>
        <Link href="/account/addresses" className={buttonVariants({ variant: 'ghost', size: 'lg', className: 'h-11 px-5' })}>
          {labels.cancel}
        </Link>
      </div>
    </form>
  )
}
