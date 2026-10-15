import 'server-only'
import { createClient } from '@/lib/supabase/server'

// Client theo phiên (RLS cho admin thấy cả danh mục ẩn), không cache. Chỉ gọi trong <Suspense>.

const COLUMNS = 'id, parent_id, name, name_en, slug, sort_order, is_active'

/** Mọi danh mục (cả danh mục ẩn), theo thứ tự hiển thị */
export async function getAdminCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('categories').select(COLUMNS).order('sort_order').order('id')
  if (error) throw new Error(`getAdminCategories: ${error.message}`)
  return data
}

export type AdminCategoryRow = Awaited<ReturnType<typeof getAdminCategories>>[number]

/** Danh sách cho trang Danh mục, kèm số sách của từng danh mục (đếm ở DB, không tải sách) */
export async function listAdminCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select(`${COLUMNS}, books(count)`)
    .order('sort_order')
    .order('id')
  if (error) throw new Error(`listAdminCategories: ${error.message}`)
  return data.map(({ books, ...category }) => ({ ...category, bookCount: books[0]?.count ?? 0 }))
}

export async function getAdminCategory(id: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categories')
    .select(`${COLUMNS}, description, description_en`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`getAdminCategory: ${error.message}`)
  return data
}

export type AdminCategory = NonNullable<Awaited<ReturnType<typeof getAdminCategory>>>
