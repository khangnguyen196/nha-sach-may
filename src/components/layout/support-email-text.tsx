import { Fragment } from 'react'
import { SUPPORT_EMAIL } from '@/lib/support'

/**
 * Hiện chuỗi đã dịch, biến email liên hệ trong đó (điền qua tham số {email}) thành link mailto.
 * Không hook, không thư viện: dùng được ở server, client và trong ErrorView.
 */
export function SupportEmailText({ text }: { text: string }) {
  const parts = text.split(SUPPORT_EMAIL)
  if (parts.length === 1) return text
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <a
          // mailto: không phải link nội bộ
          // eslint-disable-next-line no-restricted-syntax
          href={`mailto:${SUPPORT_EMAIL}`}
          className="rounded-sm break-all underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {SUPPORT_EMAIL}
        </a>
      )}
      {part}
    </Fragment>
  ))
}
