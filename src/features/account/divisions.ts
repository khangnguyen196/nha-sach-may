import type { Locale } from 'next-intl'
import divisions from './data/divisions.json'

// Dữ liệu ~430KB: chỉ import từ server (schemas, queries, Route Handler). Client nhận danh sách đã lọc qua props / API.

export type DivisionOption = { code: string; label: string }
type Unit = (typeof divisions)[number]['wards'][number]

const provincesByCode = new Map(divisions.map((province) => [province.code, province]))
const provincesByName = new Map(divisions.map((province) => [province.full_name, province]))

function label(unit: Unit, locale: Locale) {
  return locale === 'en' ? unit.full_name_en : unit.full_name
}

// Sắp theo tên ngắn ("Hà Nội", không phải "Thành phố Hà Nội") để dễ tìm trong <select>
function toOptions(units: Unit[], locale: Locale): DivisionOption[] {
  const collator = new Intl.Collator(locale)
  const short = (unit: Unit) => (locale === 'en' ? unit.name_en : unit.name)
  return [...units]
    .sort((a, b) => collator.compare(short(a), short(b)) || collator.compare(label(a, locale), label(b, locale)))
    .map((unit) => ({ code: unit.code, label: label(unit, locale) }))
}

const optionCache = new Map<string, DivisionOption[]>()

function cached(key: string, build: () => DivisionOption[]) {
  const hit = optionCache.get(key)
  if (hit) return hit
  const options = build()
  optionCache.set(key, options)
  return options
}

export function getProvinceOptions(locale: Locale) {
  return cached(locale, () => toOptions(divisions, locale))
}

/** null khi mã tỉnh không tồn tại */
export function getWardOptions(provinceCode: string, locale: Locale) {
  const province = provincesByCode.get(provinceCode)
  if (!province) return null
  return cached(`${locale}:${provinceCode}`, () => toOptions(province.wards, locale))
}

/** Mã tỉnh + mã phường → tên đầy đủ tiếng Việt để lưu DB; null khi phường không thuộc tỉnh */
export function resolveDivisionCodes(provinceCode: string, wardCode: string) {
  const province = provincesByCode.get(provinceCode)
  const ward = province?.wards.find((unit) => unit.code === wardCode)
  if (!province || !ward) return null
  return { province: province.full_name, ward: ward.full_name }
}

/** Tên đã lưu → mã (điền sẵn form sửa); phần nào không còn trong dữ liệu thì null */
export function findDivisionCodes(provinceName: string, wardName: string) {
  const province = provincesByName.get(provinceName)
  const ward = province?.wards.find((unit) => unit.full_name === wardName)
  return { provinceCode: province?.code ?? null, wardCode: ward?.code ?? null }
}

/** Tên đã lưu (tiếng Việt) → tên theo locale; không tìm thấy (dữ liệu đổi) thì giữ tên đã lưu */
export function localizeDivisionNames(names: { province: string; ward: string }, locale: Locale) {
  if (locale === 'vi') return names
  const province = provincesByName.get(names.province)
  const ward = province?.wards.find((unit) => unit.full_name === names.ward)
  return { province: province?.full_name_en ?? names.province, ward: ward?.full_name_en ?? names.ward }
}
