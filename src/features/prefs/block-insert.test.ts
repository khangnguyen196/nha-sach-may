import { describe, expect, it } from 'vitest'
import type { ContentWarning } from '@/features/warnings/labels'
import type { Result } from '@/lib/errors'
import { blockInsertError, blockMissingWarnings, singleBlockResult, type DbError } from './block-insert'

const UNIQUE: DbError = { code: '23505', message: 'duplicate key value violates unique constraint "user_blocks_author_unique"' }
const FOREIGN_KEY: DbError = { code: '23503', message: 'insert or update on table "user_blocks" violates foreign key constraint' }
const LIMIT: DbError = { code: 'P0001', message: 'PREFS_LIMIT', details: '{"max" : 50}' }

describe('blockInsertError / singleBlockResult', () => {
  it('23505 = đã chặn → ok', () => {
    expect(blockInsertError(UNIQUE)).toBe('duplicate')
    expect(singleBlockResult(UNIQUE)).toEqual({ ok: true, data: null })
    expect(singleBlockResult(null)).toEqual({ ok: true, data: null })
  })

  it('23503 → ITEM_DELETED; PREFS_LIMIT kèm max; mạng → NETWORK_ERROR; JWT → SESSION_EXPIRED; lạ → UNKNOWN', () => {
    expect(singleBlockResult(FOREIGN_KEY)).toEqual({ ok: false, code: 'ITEM_DELETED' })
    expect(singleBlockResult(LIMIT)).toEqual({ ok: false, code: 'PREFS_LIMIT', details: { max: 50 } })
    expect(singleBlockResult({ code: '', message: 'TypeError: fetch failed' })).toEqual({ ok: false, code: 'NETWORK_ERROR' })
    expect(singleBlockResult({ code: 'PGRST303', message: 'JWT expired' })).toEqual({ ok: false, code: 'SESSION_EXPIRED' })
    expect(singleBlockResult({ code: '23514', message: 'new row violates check constraint' })).toEqual({
      ok: false,
      code: 'UNKNOWN',
    })
  })
})

/** Giả lập user_blocks (nhãn) cho blockMissingWarnings: `script` = kết quả lần insert thứ n (null = thành công) */
function fakeStore(initial: ContentWarning[], script: ((stored: ContentWarning[]) => DbError | null)[]) {
  const stored = [...initial]
  const inserts: ContentWarning[][] = []
  const readBlocked = async (): Promise<Result<readonly string[]>> => ({ ok: true, data: [...stored] })
  const insert = async (labels: ContentWarning[]) => {
    inserts.push(labels)
    const error = script[inserts.length - 1]?.(stored) ?? null
    if (!error) stored.push(...labels)
    return error
  }
  return { stored, inserts, readBlocked, insert }
}

describe('blockMissingWarnings (ẩn mọi nhãn của sách, một câu insert)', () => {
  it('thêm đúng các nhãn còn thiếu trong MỘT lần insert', async () => {
    const store = fakeStore(['loss'], [])
    expect(await blockMissingWarnings(['self_harm', 'loss', 'violence'], store.readBlocked, store.insert)).toEqual({
      ok: true,
      data: null,
    })
    expect(store.inserts).toEqual([['violence', 'self_harm']])
  })

  it('đã chặn đủ → ok, không insert', async () => {
    const store = fakeStore(['adult', 'loss'], [])
    expect(await blockMissingWarnings(['adult'], store.readBlocked, store.insert)).toEqual({ ok: true, data: null })
    expect(store.inserts).toEqual([])
  })

  it('23505 (tab khác vừa thêm một nhãn) → đọc lại, insert phần còn thiếu thêm một lần → ok', async () => {
    const store = fakeStore(
      [],
      [
        (stored) => {
          stored.push('violence')
          return UNIQUE
        },
      ],
    )
    expect(await blockMissingWarnings(['violence', 'adult'], store.readBlocked, store.insert)).toEqual({
      ok: true,
      data: null,
    })
    expect(store.inserts).toEqual([['violence', 'adult'], ['adult']])
    expect(store.stored.sort()).toEqual(['adult', 'violence'])
  })

  it('23505 hai lần mà vẫn còn thiếu → UNKNOWN (không lặp vô hạn); hai lần mà đã đủ → ok', async () => {
    const stuck = fakeStore([], [() => UNIQUE, () => UNIQUE, () => UNIQUE])
    expect(await blockMissingWarnings(['adult'], stuck.readBlocked, stuck.insert)).toEqual({ ok: false, code: 'UNKNOWN' })
    expect(stuck.inserts).toHaveLength(2)

    const raced = fakeStore(
      [],
      [
        () => UNIQUE,
        (stored) => {
          stored.push('adult')
          return UNIQUE
        },
      ],
    )
    expect(await blockMissingWarnings(['adult'], raced.readBlocked, raced.insert)).toEqual({ ok: true, data: null })
  })

  it('PREFS_LIMIT → lỗi kèm max, không nhãn nào được thêm; đọc lỗi → trả lỗi đọc', async () => {
    const store = fakeStore(['loss'], [() => LIMIT])
    expect(await blockMissingWarnings(['adult', 'violence'], store.readBlocked, store.insert)).toEqual({
      ok: false,
      code: 'PREFS_LIMIT',
      details: { max: 50 },
    })
    expect(store.stored).toEqual(['loss'])

    const readFails = async (): Promise<Result<readonly string[]>> => ({ ok: false, code: 'NETWORK_ERROR' })
    expect(await blockMissingWarnings(['adult'], readFails, store.insert)).toEqual({ ok: false, code: 'NETWORK_ERROR' })
  })

  it('sách không có nhãn hợp lệ → ok, không insert (action chặn trước bằng INVALID_INPUT)', async () => {
    const store = fakeStore([], [])
    expect(await blockMissingWarnings(['evil'], store.readBlocked, store.insert)).toEqual({ ok: true, data: null })
    expect(store.inserts).toEqual([])
  })
})
