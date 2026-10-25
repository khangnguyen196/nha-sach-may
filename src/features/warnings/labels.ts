import { Constants, type Database } from '@/types/database'

// Nhãn cảnh báo nội dung = enum public.content_warning (schema.sql mục 16). Danh sách lấy từ types sinh tự động, đúng
// thứ tự enum (trigger chuẩn hóa nhãn trong DB cũng xếp theo thứ tự này). Tên hiển thị: messages → contentWarnings.
// Chỉ hằng + kiểu (không 'server-only'): form admin / khung cảnh báo ở client dùng được.

export type ContentWarning = Database['public']['Enums']['content_warning']

export const CONTENT_WARNINGS: readonly ContentWarning[] = Constants.public.Enums.content_warning
