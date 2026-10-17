import { describe, expect, it } from 'vitest'
import { assertLocalSupabase, parseStatusEnv, PRODUCTION_SUPABASE_REF } from './e2e-env'

describe('assertLocalSupabase', () => {
  it('từ chối project production', () => {
    expect(() => assertLocalSupabase(`https://${PRODUCTION_SUPABASE_REF}.supabase.co`)).toThrow(/production/)
  })

  it('từ chối project cloud khác và URL lạ', () => {
    expect(() => assertLocalSupabase('https://abcdefghijklmnopqrst.supabase.co')).toThrow(/local/)
    expect(() => assertLocalSupabase('http://127.0.0.1.example.com:54321')).toThrow(/local/)
    expect(() => assertLocalSupabase('khong-phai-url')).toThrow(/không hợp lệ/)
    expect(() => assertLocalSupabase(undefined)).toThrow(/Thiếu/)
  })

  it('nhận Supabase local', () => {
    expect(assertLocalSupabase('http://127.0.0.1:54321')).toBe('http://127.0.0.1:54321')
    expect(assertLocalSupabase('http://localhost:54321')).toBe('http://localhost:54321')
  })
})

it('parseStatusEnv đọc dòng KEY="value"', () => {
  const vars = parseStatusEnv('API_URL="http://127.0.0.1:54321"\r\nANON_KEY="a.b.c"\nSTUDIO_URL=\nrác\n')
  expect(vars.get('API_URL')).toBe('http://127.0.0.1:54321')
  expect(vars.get('ANON_KEY')).toBe('a.b.c')
  expect(vars.get('STUDIO_URL')).toBe('')
  expect(vars.size).toBe(3)
})
