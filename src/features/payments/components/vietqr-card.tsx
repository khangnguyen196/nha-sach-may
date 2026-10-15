import { TriangleAlertIcon } from 'lucide-react'
import { getFormatter, getTranslations } from 'next-intl/server'
import { encode } from 'uqr'
import { getBankAccount } from '../bank'
import { buildVietQrPayload } from '../vietqr'

type Props = { orderCode: string; amount: number }

/** Ma trận QR → một <path> (mỗi ô tối một hình vuông 1×1), vẽ ở server: 0 KB JS client */
function QrSvg({ payload, label }: { payload: string; label: string }) {
  const { data, size } = encode(payload, { ecc: 'M', border: 2 })
  const cells: string[] = []
  for (const [y, row] of data.entries()) {
    for (const [x, dark] of row.entries()) if (dark) cells.push(`M${x},${y}h1v1h-1z`)
  }
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      className="size-48 rounded-md bg-qr-background fill-qr sm:size-56"
      data-testid="vietqr-code"
    >
      <path d={cells.join('')} />
    </svg>
  )
}

/**
 * Thẻ chuyển khoản VietQR cho đơn `bank_transfer` chưa thanh toán (trang đặt hàng thành công, chi tiết đơn).
 * Nội dung chuyển khoản = mã đơn để cửa hàng đối soát. Thông tin demo (chưa cấu hình tài khoản thật) → cảnh báo.
 */
export async function VietQrCard({ orderCode, amount }: Props) {
  const [t, format] = await Promise.all([getTranslations('payment'), getFormatter()])
  const bank = getBankAccount()
  const payload = buildVietQrPayload({ bankBin: bank.bin, accountNo: bank.accountNo, amount, description: orderCode })
  const rows: [string, string, string?][] = [
    [t('bank'), bank.bankName],
    [t('accountNo'), bank.accountNo, 'vietqr-account'],
    [t('accountName'), bank.accountName],
    [t('amount'), format.number(amount, 'price'), 'vietqr-amount'],
    [t('content'), orderCode, 'vietqr-content'],
  ]

  return (
    <section aria-labelledby="vietqr-title" className="rounded-lg border border-primary/40 bg-surface p-5" data-testid="vietqr">
      <h2 id="vietqr-title" className="font-semibold">
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('lead')}</p>
      {bank.demo && (
        <p className="mt-4 flex gap-2 rounded-md border border-sale/40 bg-sale/10 px-3 py-2.5 text-sm text-sale" data-testid="vietqr-demo">
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('demoWarning')}
        </p>
      )}
      <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <QrSvg payload={payload} label={t('qrLabel', { code: orderCode })} />
        <dl className="grid w-full gap-3 text-sm">
          {rows.map(([label, value, testId]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 font-medium break-all select-all" data-testid={testId}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{t('afterTransfer')}</p>
    </section>
  )
}
