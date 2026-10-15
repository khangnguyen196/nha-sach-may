// Ô `datetime-local` không có múi giờ: admin nhập giờ Việt Nam (UTC+7, không có giờ mùa hè) → đổi sang timestamptz
// với offset cố định, không phụ thuộc múi giờ của server (Vercel chạy UTC).

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/** `2026-10-20T08:30` (giờ VN) → ISO UTC; sai định dạng hoặc ngày giờ không có thật (31/02, 24:00) → null */
export function vnInputToIso(value: string): string | null {
  const match = LOCAL_INPUT.exec(value)
  if (!match) return null
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0] = match
    .slice(1)
    .map((part) => (part === undefined ? 0 : Number(part)))
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
  // Date.UTC tự cộng tràn (31/02 → 03/03, 24:00 → hôm sau): so lại từng phần để bắt giá trị không có thật
  const exact =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute &&
    date.getUTCSeconds() === second
  return exact ? new Date(date.getTime() - VN_OFFSET_MS).toISOString() : null
}

/** timestamptz → giá trị cho ô `datetime-local` theo giờ VN (`2026-10-20T08:30`) */
export function isoToVnInput(iso: string | null): string {
  if (!iso) return ''
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  return new Date(time + VN_OFFSET_MS).toISOString().slice(0, 16)
}
