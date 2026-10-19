import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// CLAUDE.md → Hiệu năng: module chạy ở client của cửa hàng không import zod (≈30KB gzip; từng lọt vào mọi trang qua badge
// giỏ, rồi vào palette ⌘K qua features/books/schemas.ts). Test chỉ xét import trực tiếp của file 'use client'; import
// gián tiếp (file client → util → zod) vẫn phải xem bằng `next analyze` / scripts/analyze-diff.mjs.
// Admin không có ngân sách JS (perf-js ★6: book-form.tsx giữ zod) → bỏ qua.

const SRC = join(import.meta.dirname, '..')
const ADMIN = [/^app[\\/]admin[\\/]/, /^components[\\/]admin[\\/]/, /^features[\\/]admin[\\/]/]

function clientFiles(): string[] {
  return readdirSync(SRC, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => !ADMIN.some((pattern) => pattern.test(relative(SRC, file))))
    .filter((file) => /^\s*['"]use client['"]/.test(readFileSync(file, 'utf8')))
}

const isZod = (specifier: string) => specifier === 'zod' || specifier.startsWith('zod/')
const isSchemas = (specifier: string) => /(^|\/)schemas$/.test(specifier)

/** Import có mang giá trị lúc chạy không (`import type` / mọi tên đều `type` thì bị xóa khi build) */
function importsValue(declaration: ts.ImportDeclaration) {
  const clause = declaration.importClause
  if (!clause) return true
  if (clause.isTypeOnly) return false
  if (clause.name) return true
  const bindings = clause.namedBindings
  if (!bindings) return false
  if (ts.isNamespaceImport(bindings)) return true
  return bindings.elements.some((element) => !element.isTypeOnly)
}

function forbiddenImports(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  return source.statements
    .filter(ts.isImportDeclaration)
    .filter((declaration) => {
      const specifier = declaration.moduleSpecifier
      if (!ts.isStringLiteral(specifier)) return false
      return (isZod(specifier.text) || isSchemas(specifier.text)) && importsValue(declaration)
    })
    .map((declaration) => declaration.getText(source))
}

describe('client của cửa hàng không import zod', () => {
  const files = clientFiles()

  it('tìm thấy file client để kiểm', () => {
    expect(files.length).toBeGreaterThan(20)
    expect(files.some((file) => file.endsWith('search-palette.tsx'))).toBe(true)
  })

  it.each(files.map((file) => [relative(SRC, file), file]))('%s', (_, file) => {
    expect(forbiddenImports(file)).toEqual([])
  })
})
