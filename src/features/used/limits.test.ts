import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { USED_PENDING_LIMIT } from './limits'

const schemaSql = readFileSync(join(import.meta.dirname, '../../../supabase/schema.sql'), 'utf8')

describe('USED_PENDING_LIMIT', () => {
  it('trùng private.used_pending_limit() trong schema.sql', () => {
    const value = /function private\.used_pending_limit\(\)[\s\S]*?\$\$\s*select (\d+)\s*\$\$/.exec(schemaSql)?.[1]
    expect(Number(value)).toBe(USED_PENDING_LIMIT)
  })
})
