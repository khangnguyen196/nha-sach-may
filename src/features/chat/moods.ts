// Tâm trạng / nhu cầu → danh mục lá (slug). Từ khóa viết không dấu, khớp với câu đã qua normalizeSearch.
// Theo data.md (Phase 11): sách tiếng Việt nhóm kỹ năng / tâm lý rất ít (ky-nang-song 2 cuốn còn hàng, tam-ly-hoc 1)
// → nhóm cảm xúc kéo thêm văn học Việt (truyện ngắn, tiểu thuyết, thơ) để ứng viên luôn có sách tiếng Việt.

export type Mood = { keywords: readonly string[]; categories: readonly string[] }

const VIETNAMESE_LITERATURE = ['truyen-ngan-tan-van', 'tieu-thuyet', 'tho'] as const

export const MOODS: readonly Mood[] = [
  {
    // Mông lung, lạc hướng, buồn, mệt mỏi…
    keywords: [
      'mong lung', 'lac huong', 'chenh venh', 'bon chon', 'hoang mang', 'mat phuong huong', 'buon', 'co don',
      'tram cam', 'met moi', 'kiet suc', 'ap luc', 'cang thang', 'stress', 'lo au', 'that bai', 'that tinh',
      'chua lanh', 'binh yen', 'tinh than', 'dong luc', 'y nghia', 'cuoc song', 'ban than', 'vo dinh', 'chan nan',
    ],
    categories: ['ky-nang-song', 'tam-ly-hoc', ...VIETNAMESE_LITERATURE, 'ngoai-van-ky-nang-song'],
  },
  {
    keywords: ['nhe nhang', 'thu gian', 'cuoi tuan', 'giai tri', 'doc cho vui', 'de doc', 'ngan gon'],
    categories: [...VIETNAMESE_LITERATURE, 'truyen-tranh', 'ngoai-van-van-hoc'],
  },
  {
    keywords: ['tinh yeu', 'lang man', 'tuoi tre', 'thanh xuan', 'ky niem', 'hoai niem', 'que huong', 'gia dinh'],
    categories: [...VIETNAMESE_LITERATURE, 'ngoai-van-van-hoc'],
  },
  {
    keywords: ['tho', 'van hoc', 'tieu thuyet', 'truyen ngan', 'tan van', 'van chuong'],
    categories: [...VIETNAMESE_LITERATURE, 'ngoai-van-van-hoc'],
  },
  {
    keywords: ['kinh doanh', 'khoi nghiep', 'lanh dao', 'quan tri', 'quan ly', 'cong viec', 'su nghiep', 'thanh cong'],
    categories: ['quan-tri-lanh-dao', 'ngoai-van-kinh-doanh', 'ky-nang-song'],
  },
  {
    keywords: ['tien bac', 'tai chinh', 'dau tu', 'tiet kiem', 'lam giau'],
    categories: ['tai-chinh-ca-nhan', 'ngoai-van-kinh-doanh'],
  },
  {
    keywords: ['ky nang', 'thoi quen', 'giao tiep', 'tu duy', 'phat trien ban than', 'tam ly'],
    categories: ['ky-nang-song', 'tam-ly-hoc', 'ngoai-van-ky-nang-song'],
  },
  {
    keywords: ['lich su', 'chien tranh', 'dia ly', 'ha noi', 'van hoa', 'truyen thong', 'dan toc'],
    categories: ['lich-su-dia-ly', 'ngoai-van-lich-su-khoa-hoc'],
  },
  {
    keywords: ['khoa hoc', 'vu tru', 'thien van', 'vat ly', 'tri thuc', 'kham pha'],
    categories: ['ngoai-van-lich-su-khoa-hoc', 'kien-thuc-bach-khoa'],
  },
  {
    keywords: ['thieu nhi', 'tre em', 'con nho', 'cho be', 'cho con', 'truyen tranh', 'mau giao'],
    categories: ['truyen-tranh', 'kien-thuc-bach-khoa', 'ngoai-van-thieu-nhi'],
  },
  {
    keywords: ['hoc tieng anh', 'luyen tieng anh', 'ngu phap', 'tu vung', 'ielts', 'toeic'],
    categories: ['tieng-anh'],
  },
  {
    keywords: ['tieng nhat', 'nhat ban'],
    categories: ['tieng-nhat'],
  },
]

/** Danh mục lá khớp câu đã bỏ dấu, theo thứ tự xuất hiện trong MOODS, không trùng */
export function moodCategories(normalized: string): string[] {
  const padded = ` ${normalized} `
  const slugs = MOODS.filter((mood) => mood.keywords.some((keyword) => padded.includes(` ${keyword} `))).flatMap(
    (mood) => mood.categories,
  )
  return [...new Set(slugs)]
}
