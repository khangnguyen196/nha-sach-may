import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Điều hướng phải đi qua i18n/navigation.ts để giữ locale và pathname đã dịch
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'next/link', message: 'Dùng Link từ @/i18n/navigation.' },
            {
              name: 'next/navigation',
              importNames: ['redirect', 'permanentRedirect', 'useRouter', 'usePathname'],
              message: 'Dùng redirect / useRouter / usePathname từ @/i18n/navigation.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='SUPABASE_SERVICE_ROLE_KEY']",
          message: 'Service role key chỉ dùng trong scripts/, không bao giờ trong src/.',
        },
        {
          selector: "CallExpression[callee.property.name='select'][arguments.0.value='*']",
          message: "Không select('*'): chỉ lấy cột cần dùng.",
        },
        {
          // href là chuỗi cố định (#main, https://…) thì được; href tính toán = link nội bộ → phải qua Link
          selector: "JSXOpeningElement[name.name='a'] > JSXAttribute[name.name='href'] > JSXExpressionContainer",
          message: 'Link nội bộ dùng Link từ @/i18n/navigation để giữ locale và pathname đã dịch.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['src/i18n/navigation.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Admin không có [locale] (chỉ tiếng Việt, URL viết thẳng): link qua AdminLink; redirect / useRouter /
    // usePathname dùng bản của next/navigation
    files: ['src/app/admin/**', 'src/components/admin/**', 'src/features/admin/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'next/link', message: 'Dùng AdminLink từ @/components/admin/admin-link.' }] },
      ],
    },
  },
  {
    files: ['src/components/admin/admin-link.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // Regex dựng bằng new RegExp(`…`) trong template literal: `\?` / `\d` mất dấu `\` (phải viết `\\?`), test vẫn
    // chạy nhưng khớp sai. eslint-config-next không bật luật này.
    files: ['e2e/**/*.ts'],
    rules: { 'no-useless-escape': 'error' },
  },
  globalIgnores(['.next/**', '.claude/**', 'out/**', 'build/**', 'next-env.d.ts', 'src/types/database.ts', 'playwright-report/**', 'test-results/**']),
])

export default eslintConfig
