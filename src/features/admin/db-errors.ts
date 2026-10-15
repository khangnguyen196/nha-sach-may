/** Tên constraint unique bị vi phạm (lỗi Postgres 23505 qua PostgREST), không phải lỗi unique → null */
export function violatedUniqueConstraint(error: { code?: string; message: string }): string | null {
  if (error.code !== '23505') return null
  return /unique constraint "([^"]+)"/.exec(error.message)?.[1] ?? null
}

/**
 * Đường dẫn object trong bucket từ public URL đã lưu ở `cover_url` (`<publicBase><path>`), hoặc null nếu URL không
 * thuộc bucket này (ảnh ngoài, chưa có bìa). `publicBase` = public URL của bucket, kết thúc bằng `/`.
 */
export function storageObjectPath(url: string | null, publicBase: string): string | null {
  if (!url || !url.startsWith(publicBase)) return null
  const path = url.slice(publicBase.length).split(/[?#]/)[0] ?? ''
  if (!path || path.includes('..')) return null
  try {
    return decodeURIComponent(path)
  } catch {
    return null
  }
}
