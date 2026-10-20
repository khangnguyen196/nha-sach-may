import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

// CLAUDE.md → Hiệu năng: module chạy ở client của cửa hàng không import zod (≈30KB gzip; từng lọt vào mọi trang qua badge
// giỏ, rồi vào palette ⌘K qua features/books/schemas.ts). Test lập danh sách mọi module của src có import / export GIÁ
// TRỊ từ 'zod' (kể cả `export … from 'zod'`, `import('zod')`), rồi cấm file 'use client' import giá trị từ zod hoặc từ các
// module đó (`import type` được phép). Chỉ xét một bước: file client → util → module zod vẫn phải xem bằng
// `next analyze` / scripts/analyze-diff.mjs.
// Admin không có ngân sách JS (perf-js ★6: book-form.tsx giữ zod) → bỏ qua, trừ admin-link.tsx (client chạy ở cửa hàng:
// link "Quản trị" ở header).

const SRC = join(import.meta.dirname, '..')
const ADMIN = [/^app[\\/]admin[\\/]/, /^components[\\/]admin[\\/]/, /^features[\\/]admin[\\/]/]
const SHOP_CLIENT_IN_ADMIN = [/^components[\\/]admin[\\/]admin-link\.tsx$/]
const EXTENSIONS = ['.ts', '.tsx', '/index.ts', '/index.tsx']

const sourceFiles = readdirSync(SRC, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
  .map((entry) => join(entry.parentPath, entry.name))

const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)

const isZod = (specifier: string) => specifier === 'zod' || specifier.startsWith('zod/')

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

function exportsValue(declaration: ts.ExportDeclaration) {
  if (declaration.isTypeOnly) return false
  const clause = declaration.exportClause
  if (!clause || ts.isNamespaceExport(clause)) return true
  return clause.elements.some((element) => !element.isTypeOnly)
}

type ValueImport = { specifier: string; text: string }

/** Mọi import / re-export / import() mang giá trị của một file, kèm đoạn code để báo lỗi */
function valueImports(file: string): ValueImport[] {
  const source = parse(file)
  const found: ValueImport[] = []
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && importsValue(node)) {
      found.push({ specifier: node.moduleSpecifier.text, text: node.getText(source) })
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      exportsValue(node)
    ) {
      found.push({ specifier: node.moduleSpecifier.text, text: node.getText(source) })
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push({ specifier: node.arguments[0].text, text: node.getText(source) })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** '@/…' và đường dẫn tương đối → file trong src; package ngoài → null */
function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : null
  if (!base) return null
  if (/\.tsx?$/.test(base) && existsSync(base)) return base
  return EXTENSIONS.map((extension) => base + extension).find((candidate) => existsSync(candidate)) ?? null
}

// File 'use server' (Server Action) import vào client chỉ còn tham chiếu tới action, code + zod ở lại server
const isServerActionFile = (file: string) => /^\s*['"]use server['"]/.test(readFileSync(file, 'utf8'))
const zodModules = new Set(
  sourceFiles
    .filter((file) => !isServerActionFile(file))
    .filter((file) => valueImports(file).some(({ specifier }) => isZod(specifier))),
)

const shopClientFiles = sourceFiles
  .filter((file) => {
    const path = relative(SRC, file)
    return !ADMIN.some((pattern) => pattern.test(path)) || SHOP_CLIENT_IN_ADMIN.some((pattern) => pattern.test(path))
  })
  .filter((file) => /^\s*['"]use client['"]/.test(readFileSync(file, 'utf8')))

function forbiddenImports(file: string): string[] {
  return valueImports(file)
    .filter(({ specifier }) => {
      if (isZod(specifier)) return true
      const target = resolveLocal(file, specifier)
      return target !== null && zodModules.has(target)
    })
    .map(({ text }) => text)
}

describe('client của cửa hàng không import zod', () => {
  it('tìm thấy module zod và file client để kiểm', () => {
    const zod = [...zodModules].map((file) => relative(SRC, file).replaceAll('\\', '/'))
    expect(zod).toContain('features/books/schemas.ts')
    expect(zod).toContain('lib/text-schema.ts')
    expect(shopClientFiles.length).toBeGreaterThan(20)
    const clients = shopClientFiles.map((file) => relative(SRC, file).replaceAll('\\', '/'))
    expect(clients).toContain('features/books/components/search-palette.tsx')
    expect(clients).toContain('components/admin/admin-link.tsx')
    expect(clients).not.toContain('features/admin/books/components/book-form.tsx')
  })

  it.each(shopClientFiles.map((file) => [relative(SRC, file), file]))('%s', (_, file) => {
    expect(forbiddenImports(file)).toEqual([])
  })
})
