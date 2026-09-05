import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LoginForm } from '@/components/LoginForm'

describe('LoginForm callback errors', () => {
  it('renders an initial callback error immediately', () => {
    const html = renderToStaticMarkup(
      React.createElement(LoginForm, { error: 'Email link is invalid or has expired' }),
    )

    expect(html).toContain('Email link is invalid or has expired')
  })
})
