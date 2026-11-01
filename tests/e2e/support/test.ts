import { test as base, expect } from '@playwright/test'

export * from '@playwright/test'

/**
 * Playwright's `test`, failing on any Content-Security-Policy violation (#204).
 *
 * The preview sends the build's policy (scripts/csp/write.mjs). A violation is
 * something the app tried and the browser refused — a host missing from
 * `connect-src`, or a script that should not be there — and in production
 * that is a feature quietly not working.
 *
 * Two ears, because one is deaf where it matters: the document's
 * `securitypolicyviolation` event never hears a refused `fetch()` in the Web
 * Worker — the event fires on the worker — so the preview's policy also
 * carries `report-uri /__csp-report`, and the report request is heard here
 * whoever sent it.
 *
 * A test that provokes one on purpose waits for every copy (a page violation is
 * heard twice), then drops its own lines from `cspViolations` at the end.
 */
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [
    async ({ context }, use) => {
      const violations: string[] = []
      await context.exposeBinding('__cspViolation', (_source, line: string) => {
        violations.push(line)
      })
      await context.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          const report = (window as unknown as { __cspViolation?: (line: string) => void })
            .__cspViolation
          report?.(
            `${event.effectiveDirective} ${event.blockedURI} (${event.sourceFile || event.documentURI})`,
          )
        })
      })
      context.on('request', (request) => {
        if (!request.url().includes('/__csp-report')) return
        try {
          const body = (request.postDataJSON() as { 'csp-report'?: Record<string, string> })[
            'csp-report'
          ]
          violations.push(
            `${body?.['effective-directive']} ${body?.['blocked-uri']} (${body?.['source-file'] ?? body?.['document-uri']})`,
          )
        } catch {
          violations.push(`unreadable report: ${request.postData()}`)
        }
      })
      await use(violations)
      expect(violations, 'Content-Security-Policy violations').toEqual([])
    },
    { auto: true },
  ],
})
