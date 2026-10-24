import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { defaultConfig } from 'next/dist/server/config-shared'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const { USED_PHOTO_URL_TTL } = await import('./signed-urls')

// Quyết định 7 (a) của docs/plans/cho-sach-cu.md: link ký ảnh sách cũ hạn 7 ngày; mọi cache chứa link phải hết hạn
// TRƯỚC link (không thì trang cache hiện ảnh vỡ). Kiểm tĩnh mã nguồn:
// (i) chỉ features/used/signed-urls.ts gọi createSignedUrl(s) (giữ hằng TTL);
// (ii) mọi file của src import signed-urls hoặc features/used/queries, TRỰC TIẾP HAY BẮC CẦU (A import B, B import
//      signed-urls → A cũng tính): mỗi hàm 'use cache' gọi cacheLife('hours' | 'minutes' | 'seconds'), không profile
//      khác, không thiếu (default không có expire), không có 'use cache' đầu file;
// (iii) expire của các profile đó (cấu hình mặc định của Next, next.config.ts không khai báo cacheLife riêng) < TTL.

const SRC = join(import.meta.dirname, '../..')
const SIGNED_URLS = join(SRC, 'features/used/signed-urls.ts')
const USED_QUERIES = join(SRC, 'features/used/queries.ts')
const ALLOWED_PROFILES = ['hours', 'minutes', 'seconds'] as const
const SIGN_METHODS = new Set(['createSignedUrl', 'createSignedUrls'])

const sourceFiles = readdirSync(SRC, { withFileTypes: true, recursive: true })
  .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name))
  .map((entry) => join(entry.parentPath, entry.name))

const parsed = new Map<string, ts.SourceFile>()
function parse(file: string) {
  const cached = parsed.get(file)
  if (cached) return cached
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  parsed.set(file, source)
  return source
}
const rel = (file: string) => relative(SRC, file).replaceAll('\\', '/')

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node)
  ts.forEachChild(node, (child) => walk(child, visit))
}

/** Chỗ gọi / nhắc tới createSignedUrl(s) dưới dạng code (`x.createSignedUrl`, `x['createSignedUrls']`), không tính comment */
function signCalls(source: ts.SourceFile) {
  const found: string[] = []
  walk(source, (node) => {
    const name = ts.isPropertyAccessExpression(node)
      ? node.name.text
      : ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)
        ? node.argumentExpression.text
        : ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node.parent)
          ? node.text
          : undefined
    if (name && SIGN_METHODS.has(name)) found.push(`${source.fileName}:${node.getText(source)}`)
  })
  return found
}

/** '@/…' và đường dẫn tương đối → file .ts / .tsx trong src; package ngoài → null */
function resolveLocal(from: string, specifier: string) {
  const base = specifier.startsWith('@/')
    ? join(SRC, specifier.slice(2))
    : specifier.startsWith('.')
      ? resolve(dirname(from), specifier)
      : null
  if (!base) return null
  return [`${base}.ts`, `${base}.tsx`, base].find((file) => sourceFiles.includes(file)) ?? null
}

/** Mọi module mà file import / re-export / import() (kể cả `import type`: cẩn thận thừa còn hơn sót) */
function importedFiles(source: ts.SourceFile) {
  const files: string[] = []
  walk(source, (node) => {
    const specifier =
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
        ? node.moduleSpecifier.text
        : ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments[0] &&
            ts.isStringLiteral(node.arguments[0])
          ? node.arguments[0].text
          : undefined
    const file = specifier && resolveLocal(source.fileName, specifier)
    if (file) files.push(file)
  })
  return files
}

/**
 * Bao đóng bắc cầu: `roots` + mọi file của src import (tĩnh, `export … from`, import() động, kể cả `import type`) một
 * file đã có trong tập. Lặp tới khi không thêm được file nào.
 */
function importClosure(roots: readonly string[]) {
  const imports = new Map(sourceFiles.map((file) => [file, importedFiles(parse(file))]))
  const closure = new Set(roots)
  for (let grew = true; grew; ) {
    grew = false
    for (const [file, imported] of imports) {
      if (!closure.has(file) && imported.some((dependency) => closure.has(dependency))) {
        closure.add(file)
        grew = true
      }
    }
  }
  return [...closure]
}

const isUseCache = (statement: ts.Statement) =>
  ts.isExpressionStatement(statement) &&
  ts.isStringLiteral(statement.expression) &&
  statement.expression.text.startsWith('use cache')

type CacheProblem = string

/**
 * Mỗi hàm có directive 'use cache' (đầu thân hàm) phải gọi cacheLife với profile được phép, và chỉ profile đó.
 * 'use cache' ở đầu file (cache cả module) không được phép: mọi hàm export bị cache với profile mặc định.
 */
function cacheProblems(source: ts.SourceFile): CacheProblem[] {
  const problems: CacheProblem[] = []
  const file = rel(source.fileName)
  if (source.statements.some(isUseCache)) problems.push(`${file}: 'use cache' ở đầu file`)
  walk(source, (node) => {
    if (!ts.isFunctionLike(node) || !('body' in node) || !node.body || !ts.isBlock(node.body)) return
    if (!node.body.statements.some(isUseCache)) return
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
    const profiles: string[] = []
    walk(node.body, (inner) => {
      if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === 'cacheLife') {
        const [arg] = inner.arguments
        profiles.push(arg && ts.isStringLiteralLike(arg) ? arg.text : `<${arg?.getText(source) ?? 'không tham số'}>`)
      }
    })
    if (profiles.length === 0) problems.push(`${file}:${line}: 'use cache' không gọi cacheLife`)
    for (const profile of profiles) {
      if (!ALLOWED_PROFILES.some((allowed) => allowed === profile)) {
        problems.push(`${file}:${line}: cacheLife(${profile}) không được phép`)
      }
    }
  })
  return problems
}

describe('link ký ảnh sách cũ: cache ngắn hơn hạn link (quyết định 7a)', () => {
  it('(i) chỉ features/used/signed-urls.ts gọi createSignedUrl(s)', () => {
    const callers = sourceFiles.filter((file) => signCalls(parse(file)).length > 0).map(rel)
    expect(callers).toEqual([rel(SIGNED_URLS)])
  })

  it("(ii) file dùng signed-urls / features/used/queries (bắc cầu): mọi 'use cache' gọi cacheLife('hours' | 'minutes' | 'seconds')", () => {
    const files = importClosure([SIGNED_URLS, USED_QUERIES])
    // Kiểm được thật: có file dùng link ký, kể cả file chỉ dùng qua file khác (trang → actions → signed-urls)
    expect(files.map(rel)).toEqual(
      expect.arrayContaining([
        'features/used/queries.ts',
        'features/used/actions.ts',
        'app/[locale]/(shop)/account/my-listings/page.tsx',
        'features/admin/used/queries.ts',
        'app/admin/sach-cu/[id]/page.tsx',
      ]),
    )
    expect(files.flatMap((file) => cacheProblems(parse(file)))).toEqual([])
  })

  it('(iii) expire của profile được phép (mặc định của Next) < hạn link ký; next.config.ts không đổi cacheLife', () => {
    expect(USED_PHOTO_URL_TTL).toBe(7 * 24 * 60 * 60)
    expect(defaultConfig.cacheLife?.hours?.expire).toBe(86_400)
    for (const profile of ALLOWED_PROFILES) {
      const expire = defaultConfig.cacheLife?.[profile]?.expire
      expect(expire, profile).toBeTypeOf('number')
      expect(expire ?? Infinity, profile).toBeLessThan(USED_PHOTO_URL_TTL)
    }
    // Khai báo cacheLife riêng trong next.config.ts có thể đổi expire của 'hours' → test này phải đọc lại cấu hình đó
    const nextConfig = readFileSync(join(SRC, '../next.config.ts'), 'utf8')
    expect(nextConfig).not.toMatch(/\bcacheLife\b/)
  })
})
