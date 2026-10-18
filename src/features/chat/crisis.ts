// Lớp 1 của an toàn (docs/plans/phase-11.md): câu bày tỏ ý định tự hại → trả câu hỗ trợ cố định, không gọi AI,
// không trừ lượt. Chạy trước mọi bước khác (kể cả kiểm khu vực). Thiên về an toàn: bắt nhầm chỉ đổi gợi ý sách thành
// câu hỗ trợ; bỏ sót thì lớp 2 (system prompt, intent "crisis") bù.
import { normalizeSearch } from '@/lib/like'

// Câu có dấu → so với cụm có dấu. Câu không dấu → so với cụm không dấu (tách riêng để "từ từ" không thành "tu tu").
const ACCENTED = [
  'tự tử',
  'tự sát',
  'tự vẫn',
  'muốn chết',
  'thà chết',
  'không muốn sống',
  'không thiết sống',
  'chán sống',
  'kết liễu',
  'rạch tay',
  'cắt tay',
  'uống thuốc ngủ',
  'nhảy cầu tự',
  'làm hại bản thân',
  'tự làm hại',
  'tự làm đau',
  'không còn lý do để sống',
  'kết thúc cuộc đời',
  'kết thúc cuộc sống',
  'biến mất khỏi thế giới',
]

const UNACCENTED = [
  'muon tu tu',
  'dinh tu tu',
  'se tu tu',
  'tu tu chet',
  'tu sat',
  'tu van chet',
  'muon chet',
  'tha chet',
  'khong muon song',
  'khong thiet song',
  'chan song',
  'ket lieu',
  'rach tay',
  'uong thuoc ngu',
  'nhay cau tu',
  'lam hai ban than',
  'tu lam hai',
  'tu lam dau',
  'khong con ly do de song',
  'ket thuc cuoc doi',
  'ket thuc cuoc song',
  'bien mat khoi the gioi',
]

// Luôn kiểm, cả câu có dấu (khách hay chen tiếng Anh)
const ENGLISH = [
  'suicide',
  'suicidal',
  'kill myself',
  'killing myself',
  'end my life',
  'ending my life',
  'want to die',
  'wanna die',
  'self harm',
  'self-harm',
  'hurt myself',
  'cut myself',
]

// "đẹp muốn chết", "ngon muốn chết": muốn chết đi sau tính từ là cách nói quá, không phải ý định tự hại
const HYPERBOLE_BEFORE_DIE = ['đẹp', 'ngon', 'vui', 'sướng', 'cười', 'nóng', 'lạnh', 'đói', 'no', 'thèm', 'xinh', 'hay', 'nhớ']
const HYPERBOLE_BEFORE_DIE_UNACCENTED = ['dep', 'ngon', 'vui', 'suong', 'cuoi', 'nong', 'lanh', 'doi', 'no', 'them', 'xinh', 'hay', 'nho']

function hasVietnameseMarks(text: string) {
  return /[̀-ͯ]/.test(text.normalize('NFD')) || /[đĐ]/.test(text)
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Cụm đứng riêng (không dính chữ cái hai bên), bỏ trường hợp cách nói quá trước "muốn chết" */
function containsPhrase(text: string, phrase: string, hyperbole: readonly string[]) {
  const pattern = new RegExp(`(^|[^\\p{L}])${escape(phrase)}(?=$|[^\\p{L}])`, 'gu')
  for (const match of text.matchAll(pattern)) {
    const before = text.slice(0, match.index + (match[1] ?? '').length).trimEnd()
    const lastWord = before.split(/[^\p{L}]+/u).at(-1) ?? ''
    const isDie = phrase.endsWith('muốn chết') || phrase.endsWith('muon chet')
    if (isDie && hyperbole.includes(lastWord)) continue
    return true
  }
  return false
}

export function isCrisisMessage(raw: string): boolean {
  const text = raw.normalize('NFC').toLowerCase().replace(/\s+/g, ' ')
  if (ENGLISH.some((phrase) => containsPhrase(text, phrase, []))) return true
  if (hasVietnameseMarks(text)) return ACCENTED.some((phrase) => containsPhrase(text, phrase, HYPERBOLE_BEFORE_DIE))
  const plain = normalizeSearch(text)
  return UNACCENTED.some((phrase) => containsPhrase(plain, phrase, HYPERBOLE_BEFORE_DIE_UNACCENTED))
}
