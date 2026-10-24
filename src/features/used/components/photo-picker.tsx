'use client'

import Image from 'next/image'
import { useRef, useState, type ChangeEvent } from 'react'
import type { Result } from '@/lib/errors'
import type { FormMessages } from '@/lib/form-messages'
import { fillTemplate } from '@/lib/template'
import { cn } from '@/lib/utils'
import type { UploadedPhoto } from '../actions'

/** Ảnh gửi lên server: cạnh dài ≤ 1600px, JPEG (server nén lại về WebP ≤ 1200px). Giữ body dưới 4.5MB của Server Action */
const CLIENT_MAX_SIDE = 1600
const CLIENT_JPEG_QUALITY = 0.85
export const MAX_PHOTOS = 3

export type PhotoItem = {
  key: number
  path: string | null
  url: string | null
  uploading: boolean
  /** Ảnh đã gắn tin đang sửa: bỏ khỏi form không xóa ngay (xóa sau khi lưu tin, ở server) */
  saved: boolean
}

type Labels = {
  photos: string
  photosHint: string
  addPhoto: string
  uploading: string
  photoUnreadable: string
  photoAlt: string
  photoMissing: string
  removePhoto: string
}

type Props = {
  photos: PhotoItem[]
  onChange: (update: (photos: PhotoItem[]) => PhotoItem[]) => void
  uploadPhoto: (formData: FormData) => Promise<Result<UploadedPhoto>>
  deletePhoto: (path: string) => Promise<Result<null>>
  labels: Labels
  messages: FormMessages
  error?: string
  disabled: boolean
}

/**
 * Thu nhỏ ảnh ở trình duyệt (canvas, xoay theo EXIF qua createImageBitmap) → JPEG. Canvas không chép EXIF / GPS sang
 * ảnh ra. Không giải mã được (VD HEIC trên Chrome / Firefox) → null.
 */
async function shrinkPhoto(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return null
  }
  const scale = Math.min(1, CLIENT_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return null
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', CLIENT_JPEG_QUALITY))
}

let nextKey = 0

/**
 * Ảnh của tin (1–3): chọn file (không đặt `capture`: điện thoại cho chọn camera hoặc thư viện) → thu nhỏ → tải từng ảnh
 * (mỗi lần gọi Server Action một ảnh) → xem trước bằng link ký server trả về. Bỏ ảnh vừa tải → xóa ngay khỏi kho.
 * Đường dẫn ảnh đã tải xong đi vào form qua ô ẩn `photos`.
 */
export function PhotoPicker({ photos, onChange, uploadPhoto, deletePhoto, labels, messages, error, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null)
  /** Ảnh bị bỏ khi đang tải: tải xong thì xóa luôn */
  const dropped = useRef(new Set<number>())
  const [photoError, setPhotoError] = useState<string | null>(null)

  async function removeUploaded(path: string) {
    try {
      await deletePhoto(path)
    } catch {
      // Mất mạng: ảnh mồ côi được dọn khi mở trang đăng tin (sau 24 giờ)
    }
  }

  async function upload(file: File) {
    const key = nextKey++
    onChange((current) => [...current, { key, path: null, url: null, uploading: true, saved: false }])
    const drop = () => onChange((current) => current.filter((photo) => photo.key !== key))

    const blob = await shrinkPhoto(file)
    if (!blob) {
      drop()
      setPhotoError(labels.photoUnreadable)
      return
    }
    const formData = new FormData()
    formData.set('photo', blob, 'photo.jpg')
    let result: Result<UploadedPhoto>
    try {
      result = await uploadPhoto(formData)
    } catch {
      result = { ok: false, code: 'NETWORK_ERROR' }
    }
    if (!result.ok) {
      drop()
      setPhotoError(result.message ?? messages.errors[result.code] ?? messages.errors.UNKNOWN)
      return
    }
    if (dropped.current.has(key)) {
      void removeUploaded(result.data.path)
      return
    }
    const { path, url } = result.data
    onChange((current) =>
      current.map((photo) => (photo.key === key ? { ...photo, path, url, uploading: false } : photo)),
    )
  }

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_PHOTOS - photos.length)
    // Cho chọn lại đúng file đó lần nữa (VD sau khi bỏ ảnh)
    event.target.value = ''
    setPhotoError(null)
    // Tuần tự: trần 30 ảnh / người đếm lúc tải lên, tải song song có thể vượt
    for (const file of files) await upload(file)
  }

  function remove(photo: PhotoItem) {
    setPhotoError(null)
    onChange((current) => current.filter((item) => item.key !== photo.key))
    if (photo.uploading) dropped.current.add(photo.key)
    else if (!photo.saved && photo.path) void removeUploaded(photo.path)
    input.current?.focus()
  }

  const message = photoError ?? error
  const full = photos.length >= MAX_PHOTOS

  return (
    <fieldset className="grid gap-2" aria-describedby="listing-photos-hint">
      <legend className="text-sm font-medium">{labels.photos}</legend>
      <p id="listing-photos-hint" className="text-xs text-muted-foreground">
        {labels.photosHint}
      </p>
      <ul className="mt-1 grid grid-cols-3 gap-3" data-testid="listing-photos">
        {photos.map((photo, index) => (
          <li key={photo.key} className="relative">
            <div className="relative aspect-[3/4] overflow-hidden rounded-cover border bg-surface-raised">
              {photo.uploading ? (
                <span role="status" className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                  {labels.uploading}
                </span>
              ) : photo.url ? (
                // Link ký: mỗi lần một URL khác, ảnh đã nén WebP lúc tải lên → không qua bộ tối ưu ảnh của Next
                <Image
                  src={photo.url}
                  alt={fillTemplate(labels.photoAlt, { number: index + 1 })}
                  fill
                  unoptimized
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                  {labels.photoMissing}
                </span>
              )}
            </div>
            {photo.path && !photo.uploading && <input type="hidden" name="photos" value={photo.path} />}
            <button
              type="button"
              onClick={() => remove(photo)}
              disabled={disabled}
              aria-label={fillTemplate(labels.removePhoto, { number: index + 1 })}
              className="absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors outline-none hover:bg-surface-raised focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              {/* lucide x, vẽ thẳng: client leaf không import lucide (CLAUDE.md → Hiệu năng) */}
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
      {!full && (
        <label
          className={cn(
            'mt-1 inline-flex h-11 w-fit cursor-pointer items-center rounded-md border border-input px-4 text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 hover:bg-surface-raised',
            disabled && 'pointer-events-none opacity-60',
          )}
        >
          {labels.addPhoto}
          <input
            ref={input}
            // Không có `name`: file gốc không đi theo form đăng tin (chỉ đường dẫn ảnh đã tải, ô ẩn `photos`)
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            disabled={disabled}
            onChange={choose}
            className="sr-only"
          />
        </label>
      )}
      {message && (
        <p role="alert" className="text-sm text-destructive" data-testid="listing-photos-error">
          {message}
        </p>
      )}
    </fieldset>
  )
}
