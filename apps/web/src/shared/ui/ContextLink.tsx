import { forwardRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { LinkProps } from 'react-router-dom'

export const ContextLink = forwardRef<HTMLAnchorElement, LinkProps>(
  function ContextLink({ to, ...props }, ref) {
    const [params] = useSearchParams()
    const period = params.get('billingPeriodId')
    let destination = to
    if (period && typeof to === 'string' && to.startsWith('/')) {
      const url = new URL(to, 'http://local')
      if (!url.searchParams.has('billingPeriodId'))
        url.searchParams.set('billingPeriodId', period)
      destination = `${url.pathname}${url.search}${url.hash}`
    }
    return <Link {...props} ref={ref} to={destination} />
  },
)
