// Lọc trước ≤ 30 sách ứng viên cho một câu hỏi (docs/plans/phase-11.md → "Lọc ứng viên"). Hàm thuần: catalog rút gọn
// (đã cache) + danh mục + câu của khách → danh sách ổn định (cùng đầu vào → cùng kết quả). Không gửi cả catalog cho AI.
import { truncateText } from '@/features/books/utils'
import { normalizeSearch } from '@/lib/like'
import { CHAT_INPUT } from './config'
import { moodCategories } from './moods'
import type { ChatCatalogBook } from './queries'

export type CatalogCategory = { id: number; parent_id: number | null; name: string; slug: string }

export type Candidate = {
  slug: string
  title: string
  authors: string[]
  category: string
  language: string
  description: string
}

type Prepared = {
  book: ChatCatalogBook
  categorySlug: string | null
  categoryName: string
  title: string
  authors: string
  category: string
  description: string
}

/** Mỗi danh mục tối đa bao nhiêu cuốn ở bước (c), (d); số cuốn cùng danh mục với sách đang xem; số cuốn khớp từ khóa */
const PER_CATEGORY = 5
const SAME_CATEGORY = 6
const TOP_SCORED = 16

const STOPWORDS = new Set([
  // tiếng Việt (đã bỏ dấu)
  'toi', 'minh', 'em', 'anh', 'chi', 'ban', 'cho', 'cua', 'va', 'la', 'co', 'khong', 'nao', 'gi', 'mot', 'nhung',
  'cac', 'cuon', 'quyen', 'sach', 'doc', 'muon', 'can', 'tim', 'goi', 'y', 'hay', 'dang', 'thay', 'rat', 'qua',
  've', 'voi', 'de', 'nay', 'kia', 'do', 'thi', 'ma', 'nhe', 'a', 'oi', 'giup', 'duoc', 'nen', 'hon', 'nhat',
  'cung', 'nhu', 'khi', 'neu', 'vi', 'tu', 'den', 'tren', 'trong', 'ngoai', 'nguoi', 'hop', 'ai',
  // tiếng Anh
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'i', 'me', 'my', 'is', 'are', 'book', 'books',
  'want', 'need', 'some', 'any', 'please', 'recommend', 'about', 'with', 'what', 'which',
])

const WANTS_ENGLISH = [' tieng anh ', ' ngoai van ', ' english ', ' ban goc ']

/** Bỏ dấu + chỉ giữ chữ / số, cách nhau một khoảng trắng */
export function normalizeText(text: string): string {
  return normalizeSearch(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(normalized: string) {
  const words = normalized.split(' ').filter((word) => word.length > 1 && !STOPWORDS.has(word))
  const bigrams = words.slice(1).map((word, index) => `${words[index]} ${word}`)
  return { words: [...new Set(words)], bigrams: [...new Set(bigrams)] }
}

const containsWord = (haystack: string, word: string) => ` ${haystack} `.includes(` ${word} `)

function authorNames(book: ChatCatalogBook) {
  return book.book_authors.flatMap((ba) => (ba.role === 'author' && ba.authors ? [ba.authors.name] : []))
}

function prepare(books: readonly ChatCatalogBook[], categories: readonly CatalogCategory[]): Prepared[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return books.map((book) => {
    const leaf = book.category_id === null ? undefined : byId.get(book.category_id)
    const parent = leaf?.parent_id === null || leaf === undefined ? undefined : byId.get(leaf.parent_id)
    return {
      book,
      categorySlug: leaf?.slug ?? null,
      categoryName: leaf?.name ?? '',
      title: normalizeText(book.title),
      authors: normalizeText(authorNames(book).join(' ')),
      category: normalizeText([leaf?.name, parent?.name].filter(Boolean).join(' ')),
      description: normalizeText((book.description ?? '').slice(0, CHAT_INPUT.scoringDescription)),
    }
  })
}

/** Điểm khớp từ khóa: tên ×3, tác giả ×3, danh mục ×2, mô tả ×1; bigram khớp liền cộng thêm */
function score(item: Prepared, query: ReturnType<typeof tokens>) {
  let total = 0
  for (const word of query.words) {
    if (containsWord(item.title, word)) total += 3
    if (containsWord(item.authors, word)) total += 3
    if (containsWord(item.category, word)) total += 2
    if (containsWord(item.description, word)) total += 1
  }
  for (const bigram of query.bigrams) {
    if (containsWord(item.title, bigram) || containsWord(item.authors, bigram)) total += 3
    else if (containsWord(item.category, bigram) || containsWord(item.description, bigram)) total += 2
  }
  return total
}

/** Nổi bật trước, rồi bán chạy, rồi bìa nét, rồi id (ổn định) */
function popularity(a: Prepared, b: Prepared) {
  return (
    Number(b.book.is_featured) - Number(a.book.is_featured) ||
    b.book.sold_count - a.book.sold_count ||
    (b.book.cover_width ?? 0) - (a.book.cover_width ?? 0) ||
    a.book.id - b.book.id
  )
}

export function toCandidate(item: Prepared): Candidate {
  return {
    slug: item.book.slug,
    title: item.book.title,
    authors: authorNames(item.book),
    category: item.categoryName,
    language: item.book.language,
    description: item.book.description ? truncateText(item.book.description, CHAT_INPUT.candidateDescription) : '',
  }
}

/** Lần lượt mỗi danh mục một cuốn, tới khi hết */
function roundRobin(items: readonly Prepared[], visit: (item: Prepared) => void) {
  const groups = new Map<string, Prepared[]>()
  for (const item of items) {
    const key = item.categorySlug ?? ''
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  const queues = [...groups.values()]
  while (queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const item = queue.shift()
      if (item) visit(item)
    }
  }
}

export type CandidateInput = {
  books: readonly ChatCatalogBook[]
  categories: readonly CatalogCategory[]
  message: string
  /** Cuốn đang xem (trang chi tiết sách): luôn đứng đầu, kể cả hết hàng */
  currentSlug?: string | null
  limit?: number
}

export function selectCandidates({
  books,
  categories,
  message,
  currentSlug,
  limit = CHAT_INPUT.candidates,
}: CandidateInput): Candidate[] {
  const prepared = prepare(books, categories)
  const normalized = normalizeText(message)
  const query = tokens(normalized)
  const wantsEnglish = WANTS_ENGLISH.some((phrase) => ` ${normalized} `.includes(phrase))
  const preferred = wantsEnglish ? 'en' : 'vi'
  const byLanguage = (a: Prepared, b: Prepared) =>
    Number(b.book.language === preferred) - Number(a.book.language === preferred)

  const picked: Prepared[] = []
  const seen = new Set<string>()
  const perCategory = new Map<string, number>()
  const add = (item: Prepared, { capped }: { capped: boolean }) => {
    if (picked.length >= limit || seen.has(item.book.slug)) return
    const key = item.categorySlug ?? ''
    if (capped && (perCategory.get(key) ?? 0) >= PER_CATEGORY) return
    seen.add(item.book.slug)
    perCategory.set(key, (perCategory.get(key) ?? 0) + 1)
    picked.push(item)
  }

  const inStock = prepared.filter((item) => item.book.stock > 0)

  // (a) cuốn đang xem + vài cuốn cùng danh mục lá
  const current = currentSlug ? prepared.find((item) => item.book.slug === currentSlug) : undefined
  if (current) {
    add(current, { capped: false })
    inStock
      .filter((item) => item.categorySlug === current.categorySlug && item !== current)
      .sort(popularity)
      .slice(0, SAME_CATEGORY)
      .forEach((item) => add(item, { capped: false }))
  }

  // (b) khớp từ khóa nhiều nhất
  inStock
    .map((item) => ({ item, points: score(item, query) }))
    .filter(({ points }) => points > 0)
    .sort((a, b) => b.points - a.points || byLanguage(a.item, b.item) || popularity(a.item, b.item))
    .slice(0, TOP_SCORED)
    .forEach(({ item }) => add(item, { capped: false }))

  // (c) danh mục khớp tâm trạng / nhu cầu: ngôn ngữ ưu tiên trước (mọi danh mục khớp), rồi theo thứ tự trong MOODS
  const moods = moodCategories(normalized)
  const moodRank = (item: Prepared) => moods.indexOf(item.categorySlug ?? '')
  inStock
    .filter((item) => moodRank(item) >= 0)
    .sort((a, b) => byLanguage(a, b) || moodRank(a) - moodRank(b) || popularity(a, b))
    .forEach((item) => add(item, { capped: true }))

  // (d) lấp cho đủ: xoay vòng theo danh mục, hết sách ngôn ngữ ưu tiên mới tới ngôn ngữ kia
  const rest = inStock.filter((item) => !seen.has(item.book.slug)).sort(popularity)
  for (const language of [preferred, null]) {
    roundRobin(rest.filter((item) => (language ? item.book.language === language : item.book.language !== preferred)), (item) =>
      add(item, { capped: true }),
    )
  }

  return picked.map(toCandidate)
}
