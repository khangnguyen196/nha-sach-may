/**
 * Sinh dữ liệu hành chính Tỉnh/Thành → Phường/Xã (sau sáp nhập, 2 cấp) cho sổ địa chỉ.
 *
 *   npm run build:divisions
 *
 * Nguồn: thanglequoc/vietnamese-provinces-database (MIT), CỐ ĐỊNH commit bên dưới, không theo nhánh main:
 * dữ liệu trong addresses lưu theo tên, đổi nguồn mà không duyệt lại có thể làm lệch tên đã lưu.
 * Ghi ra (đều commit):
 *   src/features/account/data/divisions.json   — dạng gọn, mỗi phường/xã một dòng
 *   src/features/account/data/NOTICE.md        — nguồn + nguyên văn LICENSE (MIT yêu cầu giữ copyright notice)
 * Không đọc env. Số tỉnh/phường sai → dừng, không ghi file. Chạy lại ra cùng nội dung.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'

const REPO = 'thanglequoc/vietnamese-provinces-database'
const COMMIT = '8b78ba5118715e1fa81769286724db79346abf52'
const SOURCE_PATH = 'json/simplified_json_generated_data_vn_units.json'
const EXPECTED_PROVINCES = 34
const EXPECTED_WARDS = 3321
const OUT_DIR = 'src/features/account/data'

const name = z.string().trim().min(1)
const unitFields = { Code: z.string().regex(/^\d+$/), Name: name, NameEn: name, FullName: name, FullNameEn: name }
const sourceSchema = z
  .array(z.object({ ...unitFields, Wards: z.array(z.object({ ...unitFields, ProvinceCode: z.string() })).min(1) }))
  .length(EXPECTED_PROVINCES)

type Unit = { code: string; name: string; name_en: string; full_name: string; full_name_en: string }

function rawUrl(path: string) {
  return `https://raw.githubusercontent.com/${REPO}/${COMMIT}/${path}`
}

async function download(path: string) {
  const res = await fetch(rawUrl(path))
  if (!res.ok) throw new Error(`Tải ${path} lỗi: HTTP ${res.status}`)
  return res.text()
}

function toUnit(source: { Code: string; Name: string; NameEn: string; FullName: string; FullNameEn: string }): Unit {
  return {
    code: source.Code,
    name: source.Name.normalize('NFC'),
    name_en: source.NameEn,
    full_name: source.FullName.normalize('NFC'),
    full_name_en: source.FullNameEn,
  }
}

function assertUnique(values: string[], label: string) {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label} bị trùng: ${value}`)
    seen.add(value)
  }
}

// Mỗi phường/xã một dòng: diff dễ đọc khi đổi commit nguồn, file nhỏ hơn JSON thụt lề đầy đủ
function serialize(provinces: (Unit & { wards: Unit[] })[]) {
  const blocks = provinces.map(({ wards, ...province }) => {
    const head = JSON.stringify(province).slice(0, -1)
    const lines = wards.map((ward) => `    ${JSON.stringify(ward)}`).join(',\n')
    return `  ${head},"wards":[\n${lines}\n  ]}`
  })
  return `[\n${blocks.join(',\n')}\n]\n`
}

function notice(license: string) {
  return `# Dữ liệu hành chính Việt Nam

\`divisions.json\` được sinh bằng \`npm run build:divisions\` (\`scripts/build-divisions.ts\`) từ:

- Nguồn: ${REPO}
- Repo: https://github.com/${REPO}
- Commit: \`${COMMIT}\`
- File gốc: \`${SOURCE_PATH}\`

Đã rút gọn (chỉ giữ mã, tên, tên đầy đủ tiếng Việt và tiếng Anh). Không sửa tay file JSON; muốn cập nhật thì đổi commit trong script rồi chạy lại.

## Giấy phép của nguồn (nguyên văn \`LICENSE\` tại commit trên)

\`\`\`
${license.trimEnd()}
\`\`\`
`
}

async function main() {
  const [rawJson, license] = await Promise.all([download(SOURCE_PATH), download('LICENSE')])
  const source = sourceSchema.parse(JSON.parse(rawJson))

  const provinces = source.map((province) => {
    for (const ward of province.Wards) {
      if (ward.ProvinceCode !== province.Code) {
        throw new Error(`Phường ${ward.Code} ghi ProvinceCode ${ward.ProvinceCode}, nằm trong tỉnh ${province.Code}`)
      }
    }
    const wards = province.Wards.map(toUnit)
    assertUnique(
      wards.map((ward) => ward.full_name),
      `Tên phường/xã trong ${province.FullName}`,
    )
    return { ...toUnit(province), wards }
  })

  const wardCount = provinces.reduce((sum, province) => sum + province.wards.length, 0)
  if (wardCount !== EXPECTED_WARDS) throw new Error(`Cần ${EXPECTED_WARDS} phường/xã, nguồn có ${wardCount}`)
  assertUnique(
    provinces.map((province) => province.code),
    'Mã tỉnh',
  )
  assertUnique(
    provinces.map((province) => province.full_name),
    'Tên tỉnh',
  )
  assertUnique(
    provinces.flatMap((province) => province.wards.map((ward) => ward.code)),
    'Mã phường/xã',
  )

  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(`${OUT_DIR}/divisions.json`, serialize(provinces))
  writeFileSync(`${OUT_DIR}/NOTICE.md`, notice(license.replace(/\r\n/g, '\n')))
  console.log(`✔ ${provinces.length} tỉnh/thành, ${wardCount} phường/xã → ${OUT_DIR}/divisions.json`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
