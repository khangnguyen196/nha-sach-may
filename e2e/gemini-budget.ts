// Lượt Gemini (giả) mà e2e cộng vào bộ đếm NGÀY trên DB local của một lượt CI (docs/plans/so-thich-canh-bao.md → Hạn
// mức Gemini). AI giả nhân 100 trần PHÚT nhưng KHÔNG nhân trần ngày, và mọi spec của một lượt CI chạy trên cùng một DB:
// - warn:day: app gửi WARNING_LIMITS.callsPerDay = 30 → mọi lượt consume_warning_quota hợp lệ của các spec (tính cả retry)
//   phải < 30, không thì gợi ý chạy sau nhận WARNING_QUOTA_EXCEEDED (warn_day).
// - gemini:day: consume_warning_quota chặn ở 400 − 100 = 300 (chat_reserve, hằng cứng trong SQL), bucket dùng chung với
//   consume_chat_quota của chatbot Mây (trần ngày của chat nhân 100 khi mock nên chat không bị chặn, nhưng mọi lượt chat
//   vẫn cộng vào) → lượt gợi ý + lượt chat của mọi spec (tính cả retry) phải < 300.
// Số đếm cho MỘT lần chạy trọn spec ở MỘT project; Vitest scripts/e2e-gemini-budget.test.ts nhân với số project chạy spec
// (regex trong playwright.config.ts) và 1 + retries của CI, so với hai trần trên. Thêm / bớt lượt ở spec thì sửa ở đây.

/**
 * Lượt consume_warning_quota hợp lệ (cộng warn:day + gemini:day). Spec gợi ý gọi AI qua helper `suggestOne` /
 * `startBatch` (Vitest đếm lời gọi); spec RLS gọi thẳng RPC một lần bằng `adminClient` (các lời gọi khác bị từ chối
 * trước bộ đếm: INVALID_INPUT / FORBIDDEN / 42501). Gợi ý tạo bằng service role không tính (không qua RPC).
 */
export const WARNING_SPEC_CALLS: Readonly<Record<string, number>> = {
  // (a) 1, (b) 1, (d) 2, (e) một lượt lô: 1
  'admin-warnings.spec.ts': 5,
  'admin-prefs-warnings-rls.spec.ts': 1,
}

/**
 * Ước trên số lượt cộng gemini:day của chatbot: mọi lần gửi câu hỏi (ask(), bấm chip; vòng lặp tính đủ số vòng; câu tự
 * hại / bị cooldown / vượt lượt của khách không cộng nhưng vẫn tính cho chắc) và mọi lời gọi consume_chat_quota trực tiếp.
 */
export const CHAT_SPEC_CALLS: Readonly<Record<string, number>> = {
  // 15 ask() + vòng lặp 10 câu (hết lượt của khách) + 1 lần bấm chip
  'chat.spec.ts': 26,
  'chat-account.spec.ts': 1,
  // consume() gọi RPC trực tiếp: 1 + 2 + 4 + 2 + 2
  'chat-quota.spec.ts': 11,
}
