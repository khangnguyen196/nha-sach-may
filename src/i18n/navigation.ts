import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)

/** href hợp lệ cho cả Link và router.push: pathname nội bộ + params + query, kiểm tra kiểu theo routing */
export type Href = Parameters<ReturnType<typeof useRouter>['push']>[0]
