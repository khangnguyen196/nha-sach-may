// Cấu hình chatbot Mây (docs/plans/phase-11.md). Đổi số ở đây; Vitest (config.test.ts) kiểm trần chung luôn thấp hơn
// giới hạn free tier của mọi model được phép.

// Model ID: https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite và …/gemini-3.1-flash-lite (stable).
// gemini-3.1-flash-lite tắt ngày 2027-05-07 (https://ai.google.dev/gemini-api/docs/deprecations).
export const ALLOWED_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const
export type GeminiModel = (typeof ALLOWED_MODELS)[number]
/** GEMINI_MODEL (env server) ghi đè, phải nằm trong ALLOWED_MODELS */
export const DEFAULT_MODEL: GeminiModel = 'gemini-3.5-flash-lite'

/** Free tier của project, chủ dự án đọc trong AI Studio (Google không công bố trên trang rate-limits) */
export const FREE_TIER = {
  checkedAt: '2026-10-18',
  limits: {
    'gemini-3.5-flash-lite': { rpm: 15, tpm: 250_000, rpd: 500 },
    'gemini-3.1-flash-lite': { rpm: 15, tpm: 250_000, rpd: 500 },
  },
} as const satisfies { checkedAt: string; limits: Record<GeminiModel, { rpm: number; tpm: number; rpd: number }> }

export const GEMINI = {
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
  timeoutMs: 10_000,
  // message 600 + 3 reason × 160 + follow_up 200 ≈ 1.300 ký tự tiếng Việt, chưa tính khóa JSON, slug, suy luận
  maxOutputTokens: 1_200,
  temperature: 0.6,
  /** Ước tính bi quan (số ký tự / 2) của phần đầu vào; quá thì bớt lịch sử rồi bớt ứng viên */
  maxPromptTokens: 7_500,
  /** Mục tiêu đầu vào thật mỗi lượt, dùng cho kiểm TPM */
  targetPromptTokens: 8_000,
} as const

/** Cooldown trong bộ nhớ instance sau 429 (phân loại theo quotaId, không theo retryDelay) */
export const COOLDOWN = { minuteMinMs: 10_000, minuteMaxMs: 60_000, unknownMs: 60_000 } as const

// Điều khoản Gemini API: người dùng ở EEA / Anh / Thụy Sĩ chỉ được phục vụ bằng gói trả phí.
// 27 nước EU + IS, LI, NO (EEA) + GB + CH = 32 mã ISO 3166-1 alpha-2 (giá trị của x-vercel-ip-country)
export const BLOCKED_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO',
  'GB', 'CH',
] as const

export const CHAT_LIMITS = {
  // Theo khách: đếm CÂU HỎI (khách = cookie, hoặc user id khi đã đăng nhập)
  visitorPerHour: 10,
  visitorPerDay: 30,
  // Theo IP băm, chỉ khách chưa đăng nhập: demo cả lớp dùng chung một IP (NAT); trần chung mới là chốt chặn chính
  ipPerHour: 60,
  ipPerDay: 200,
  // Trần chung cả web: đếm LƯỢT GỌI GEMINI (kể cả gọi lại nếu sau này có), ngày theo America/Los_Angeles
  geminiCallsPerMinute: 10,
  geminiCallsPerDay: 400,
} as const

export type ChatLimits = { [K in keyof typeof CHAT_LIMITS]: number }

// Gợi ý cảnh báo nội dung của admin (so-thich-canh-bao P-B, docs/plans/so-thich-canh-bao.md) gọi Gemini bằng CÙNG
// GEMINI_API_KEY và CÙNG model với Mây (resolveModel: GEMINI_MODEL trong ALLOWED_MODELS, không thì DEFAULT_MODEL).
// Google tính RPM / RPD theo project của khóa + model, không theo tính năng → RPC consume_warning_quota cộng mỗi lượt
// gợi ý vào bucket CHUNG gemini:minute + gemini:day như một lượt của Mây, cộng thêm warn:minute / warn:day riêng.
// Gợi ý chỉ lấy được lượt khi gemini:day sau khi cộng ≤ geminiCallsPerDay − chatReserve (300, hằng cứng trong SQL:
// private.warning_gemini_day_ceiling()) → Mây luôn còn ≥ chatReserve lượt, tổng cả web ≤ geminiCallsPerDay < rpd.
// Lô ở P-B: giãn ≥ 60_000 / callsPerMinute ms giữa các lượt (không chiếm hết mốc geminiCallsPerMinute của Mây), gặp
// WARNING_QUOTA_EXCEEDED thì dừng lô theo scope, không tự gọi lại.
export const WARNING_LIMITS = {
  /** Số sách gửi trong một lượt gọi */
  booksPerCall: 12,
  /** warn:minute (app gửi; AI giả nhân MOCK_LIMIT_MULTIPLIER như trần phút của chat) */
  callsPerMinute: 2,
  /** warn:day, ngày America/Los_Angeles (app gửi, không nhân khi mock) */
  callsPerDay: 30,
  /** Cận trên của warnCallsPerDay trong consume_warning_quota (SQL từ chối số lớn hơn) */
  hardCallsPerDay: 60,
  /** Số lượt gemini:day chừa cho Mây; ngưỡng thật nằm trong SQL (warning_gemini_day_ceiling) */
  chatReserve: 100,
} as const

/** Request gợi ý cảnh báo (features/warnings/prompt.ts): một lô ≤ booksPerCall sách, dài hơn một lượt của Mây */
export const WARNING_GEMINI = {
  timeoutMs: 25_000,
  // 12 × JSON một mục tối đa (id, 5 nhãn, lý do 200 ký tự) ≈ 3.500 ký tự ≈ 1.750 token bi quan, chừa cho suy luận
  maxOutputTokens: 3_000,
  temperature: 0.2,
  /** Trần ước tính bi quan (số ký tự / 2) của phần đầu vào một lượt; Vitest kiểm với 12 sách dài tối đa + TPM */
  maxPromptTokens: 12_000,
  /** Mô tả mỗi sách cắt còn */
  descriptionChars: 1_000,
  /** Tên sách, tác giả, danh mục cắt còn (cột không giới hạn độ dài) */
  fieldChars: 150,
  /** = cột content_warning_suggestions.reason (1–200 ký tự) */
  reasonMax: 200,
} as const

/** AI giả (e2e): mọi request từ 127.0.0.1, các project chạy song song → nới IP + trần chung; giữ giới hạn khách */
export const MOCK_LIMIT_MULTIPLIER = 100

export const CHAT_INPUT = {
  maxChars: 300,
  historyTurns: 4,
  minHistoryTurns: 2,
  maxBooks: 3,
  candidates: 30,
  minCandidates: 24,
  /** Độ dài tối đa sau khi validate (câu trả lời của AI, lượt model trong lịch sử) */
  messageMax: 600,
  reasonMax: 200,
  followUpMax: 200,
  /** Mô tả gửi kèm mỗi ứng viên / sách đang xem */
  candidateDescription: 160,
  currentBookDescription: 600,
  /** Chấm điểm: phần mô tả dùng để khớp từ khóa */
  scoringDescription: 600,
} as const

export const VISITOR_COOKIE = { name: 'may_vid', maxAgeSeconds: 30 * 24 * 60 * 60 } as const
