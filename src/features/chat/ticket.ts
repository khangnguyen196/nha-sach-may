// Vé cho MỘT lượt gọi Gemini, chỉ quota.ts cấp sau khi consume_chat_quota trừ trần chung thành công. callGemini
// đòi vé và đánh dấu đã dùng: không có đường nào gọi Gemini mà không qua bộ đếm, và một vé không dùng được hai lần.
// Trường #private làm kiểu thành danh nghĩa: object tự tạo không qua được kiểm tra kiểu lẫn kiểm tra lúc chạy.

let issuedCount = 0

export class GeminiTicket {
  #used = false

  private constructor() {}

  static issue(): GeminiTicket {
    issuedCount++
    return new GeminiTicket()
  }

  use() {
    if (this.#used) throw new Error('[chat] vé gọi Gemini đã dùng')
    this.#used = true
  }
}

/** Cho Vitest: số vé đã cấp trong tiến trình */
export function issuedTickets() {
  return issuedCount
}
