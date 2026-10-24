'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { flushSync } from 'react-dom'
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

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void }

/**
 * Giải mã ảnh, đã xoay theo EXIF. createImageBitmap(file, { imageOrientation: 'from-image' }) trước; trình duyệt cũ ném
 * TypeError với giá trị enum lạ (hoặc không có createImageBitmap) → dự phòng thẻ <img> (tự xoay theo EXIF khi vẽ lên
 * canvas). Cả hai không giải mã được (VD HEIC trên Chrome / Firefox) → null.
 */
async function decodePhoto(file: File): Promise<Decoded | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  } catch {
    // Thử <img> bên dưới
  }
  const url = URL.createObjectURL(file)
  const image = document.createElement('img')
  image.src = url
  try {
    await image.decode()
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  }
}

/**
 * Thu nhỏ ảnh ở trình duyệt (canvas) → JPEG. Canvas không chép EXIF / GPS sang ảnh ra. Không giải mã được → null.
 * drawImage / toBlob ném (VD canvas quá lớn, hết bộ nhớ) → promise lỗi, ảnh giải mã vẫn được giải phóng (finally)
 */
async function shrinkPhoto(file: File): Promise<Blob | null> {
  const decoded = await decodePhoto(file)
  if (!decoded) return null
  const canvas = document.createElement('canvas')
  try {
    const scale = Math.min(1, CLIENT_MAX_SIDE / Math.max(decoded.width, decoded.height))
    canvas.width = Math.max(1, Math.round(decoded.width * scale))
    canvas.height = Math.max(1, Math.round(decoded.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height)
  } finally {
    decoded.release()
  }
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', CLIENT_JPEG_QUALITY))
}

let nextKey = 0

const placeholder = (key: number): PhotoItem => ({ key, path: null, url: null, uploading: true, saved: false })

/**
 * Ảnh của tin (1–3): chọn file (không đặt `capture`: điện thoại cho chọn camera hoặc thư viện) → giữ chỗ ngay cho cả
 * lô (ô "đang tải", không bao giờ quá MAX_PHOTOS) → thu nhỏ → tải từng ảnh (mỗi lần gọi Server Action một ảnh) → xem
 * trước bằng link ký server trả về. Bỏ ảnh vừa tải → xóa ngay khỏi kho. Đường dẫn ảnh đã tải xong đi vào form qua ô ẩn
 * `photos`.
 */
export function PhotoPicker({ photos, onChange, uploadPhoto, deletePhoto, labels, messages, error, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  /** Ảnh bị bỏ khi đang chờ / đang tải: chưa tới lượt thì không tải, tải xong thì xóa luôn, lỗi thì không báo */
  const dropped = useRef(new Set<number>())
  /**
   * Hàng đợi tải dùng chung cho MỌI lượt chọn (chuỗi promise): mỗi lúc một ảnh. Trần 30 ảnh / người đếm lúc tải lên,
   * tải song song (kể cả hai lượt chọn liên tiếp) có thể vượt
   */
  const queue = useRef<Promise<void>>(Promise.resolve())
  /** Bỏ ảnh lúc đã đủ ảnh: ô chọn ảnh chưa render → focus sau lần render tới */
  const focusAddAfterRender = useRef(false)
  const [photoError, setPhotoError] = useState<string | null>(null)

  useEffect(() => {
    if (!focusAddAfterRender.current) return
    focusAddAfterRender.current = false
    input.current?.focus()
  })

  async function removeUploaded(path: string) {
    try {
      await deletePhoto(path)
    } catch {
      // Mất mạng: ảnh mồ côi được dọn khi mở trang đăng tin (sau 24 giờ)
    }
  }

  async function upload(key: number, file: File) {
    // Bỏ trước khi tới lượt: không tải
    if (dropped.current.has(key)) return
    const fail = (message: string) => {
      onChange((current) => current.filter((photo) => photo.key !== key))
      // Ảnh đã bỏ khỏi form: lỗi của nó không còn liên quan
      if (!dropped.current.has(key)) setPhotoError(message)
    }

    const blob = await shrinkPhoto(file)
    if (!blob) return fail(labels.photoUnreadable)
    const formData = new FormData()
    formData.set('photo', blob, 'photo.jpg')
    let result: Result<UploadedPhoto>
    try {
      result = await uploadPhoto(formData)
    } catch {
      result = { ok: false, code: 'NETWORK_ERROR' }
    }
    if (!result.ok) return fail(result.message ?? messages.errors[result.code] ?? messages.errors.UNKNOWN)
    if (dropped.current.has(key)) {
      void removeUploaded(result.data.path)
      return
    }
    const { path, url } = result.data
    onChange((current) =>
      current.map((photo) => (photo.key === key ? { ...photo, path, url, uploading: false } : photo)),
    )
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const batch = Array.from(event.target.files ?? [], (file) => ({ key: nextKey++, file }))
    // Cho chọn lại đúng file đó lần nữa (VD sau khi bỏ ảnh)
    event.target.value = ''
    setPhotoError(null)
    if (batch.length === 0) return
    // Số chỗ còn tính trong updater theo state hiện tại (gồm ô đang tải của lượt chọn trước), giữ chỗ cả lô ngay.
    // flushSync: updater chạy xong (biết ảnh nào được nhận) trước khi xếp hàng tải
    let accepted: typeof batch = []
    const filled = { full: false }
    flushSync(() =>
      onChange((current) => {
        accepted = batch.slice(0, Math.max(0, MAX_PHOTOS - current.length))
        filled.full = current.length + accepted.length >= MAX_PHOTOS
        return [...current, ...accepted.map(({ key }) => placeholder(key))]
      }),
    )
    // Đủ ảnh → ô chọn ảnh (đang giữ focus) bị gỡ khỏi trang: đưa focus tới nút "Bỏ ảnh" cuối, không rơi về body
    // (WCAG 2.4.3). flushSync đã cập nhật DOM nên focus được ngay (effect của lần render đồng bộ này đã chạy xong)
    if (filled.full) list.current?.querySelector<HTMLButtonElement>('li:last-child button')?.focus()
    for (const { key, file } of accepted) {
      queue.current = queue.current
        .then(() => upload(key, file))
        // Lỗi ngoài dự kiến của một ảnh (VD canvas ném khi thu nhỏ): bỏ ô đó + báo không đọc được ảnh (ảnh đã bị bỏ thì
        // không báo), hàng đợi vẫn chạy tiếp các ảnh sau
        .catch(() => {
          onChange((current) => current.filter((photo) => photo.key !== key))
          if (!dropped.current.has(key)) setPhotoError(labels.photoUnreadable)
        })
    }
  }

  function remove(photo: PhotoItem) {
    setPhotoError(null)
    onChange((current) => current.filter((item) => item.key !== photo.key))
    if (photo.uploading) dropped.current.add(photo.key)
    else if (!photo.saved && photo.path) void removeUploaded(photo.path)
    // Nút vừa bấm bị gỡ khỏi trang: đưa focus về ô chọn ảnh (luôn hiện lại vì đã có chỗ) sau lần render tới
    focusAddAfterRender.current = true
  }

  const message = photoError ?? error
  const full = photos.length >= MAX_PHOTOS

  return (
    <fieldset className="grid gap-2" aria-describedby="listing-photos-hint">
      <legend className="text-sm font-medium">{labels.photos}</legend>
      <p id="listing-photos-hint" className="text-xs text-muted-foreground">
        {labels.photosHint}
      </p>
      <ul ref={list} className="mt-1 grid grid-cols-3 gap-3" data-testid="listing-photos">
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
            // image/*: điện thoại cho chọn camera hoặc thư viện; iOS tự đổi ảnh HEIC sang JPEG khi trang không khai
            // nhận HEIC. Ảnh trình duyệt không giải mã được → câu lỗi photoUnreadable
            accept="image/*"
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
