import { z } from 'zod'
import { localeSchema } from '@/features/auth/schemas'
import type { ValidationKey } from '@/lib/errors'
import { getWardOptions, resolveDivisionCodes } from './divisions'

// Chỉ import ở server: addressSchema tra file dữ liệu hành chính (~430KB). Form client dùng thuộc tính HTML
// (required, maxLength) cho phản hồi nhanh, còn kiểm tra thật chạy ở Server Action với schema này.

const error = (key: ValidationKey) => ({ error: key })

// Di động VN: 0 hoặc +84, đầu số 3/5/7/8/9, thêm 8 số. Cho phép khoảng trắng, dấu chấm, gạch ngang khi nhập.
const MOBILE = /^(?:0|\+84)[35789]\d{8}$/

const phone = z
  .string(error('required'))
  .transform((value) => value.replace(/[\s.-]/g, ''))
  .pipe(z.string().regex(MOBILE, error('phone')))
  .transform((value) => value.replace(/^\+84/, '0'))

const addressFields = z.object({
  recipient_name: z.string(error('required')).trim().min(1, error('recipientName')).max(100, error('recipientName')),
  phone,
  province: z.string(error('province')).min(1, error('province')),
  ward: z.string(error('ward')).min(1, error('ward')),
  street: z.string(error('required')).trim().min(1, error('street')).max(200, error('street')),
})

/** Form gửi mã tỉnh/phường; output là đúng các cột của `addresses`, tỉnh/phường đã đổi sang tên đầy đủ tiếng Việt */
export const addressSchema = addressFields.transform(({ province, ward, ...rest }, ctx) => {
  const names = resolveDivisionCodes(province, ward)
  if (!names) {
    const provinceExists = getWardOptions(province, 'vi') !== null
    ctx.addIssue({
      code: 'custom',
      path: [provinceExists ? 'ward' : 'province'],
      message: provinceExists ? 'ward' : 'province',
    })
    return z.NEVER
  }
  return { ...rest, province: names.province, ward: names.ward }
})

export type AddressInput = z.output<typeof addressSchema>

export const addressIdSchema = z.coerce.number().int().positive()

/** Trang quay lại sau khi thêm địa chỉ (tham số bind đi qua client); lạ → về sổ địa chỉ */
export const addressReturnToSchema = z.enum(['checkout']).nullable().catch(null)

export type AddressReturnTo = z.output<typeof addressReturnToSchema>

export const emailLocaleSchema = z.object({ locale: localeSchema })
