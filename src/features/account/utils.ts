/**
 * Chữ cái hiện ở avatar header. Tên người Việt gọi theo tên (từ cuối: "Nguyễn Văn An" → "A");
 * không có tên thì dùng ký tự đầu của email.
 */
export function initialOf(nameOrEmail: string) {
  const value = nameOrEmail.trim()
  const word = value.includes('@') ? value : (value.split(/\s+/).at(-1) ?? '')
  const first = Array.from(word.normalize('NFC'))[0] ?? '?'
  return first.toLocaleUpperCase('vi')
}
