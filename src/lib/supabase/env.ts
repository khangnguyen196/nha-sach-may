// Chỉ URL + publishable key: được phép lộ ra client. Service role key KHÔNG BAO GIỜ ở src/.
// Truy cập process.env.NEXT_PUBLIC_* trực tiếp để Next inline được vào bundle client.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !publishableKey) {
    throw new Error('Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY trong .env.local')
  }
  // supabase-js tự nối /rest/v1, /auth/v1…; URL có sẵn đường dẫn sẽ lỗi "Invalid path specified in request URL"
  if (new URL(url).pathname !== '/') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL phải là URL gốc (https://<project-id>.supabase.co), không kèm /rest/v1')
  }
  return { url, publishableKey }
}
