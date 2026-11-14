/**
 * Demo fetch: while installed, every /api/* request (any origin / base) is answered in memory
 * and NEVER reaches the network; unknown /api routes get 404 {error:'not_found'}. Other requests
 * (assets, fonts) go to the original fetch.
 */
import { NOT_FOUND, isApiPath, parseUrl, route, type Routed } from './router.ts'
import { config, demoStats } from './state.ts'

type FetchFn = typeof fetch

let original: FetchFn | null = null
let wrapper: FetchFn | null = null
let refs = 0

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

/** True when `url` (absolute or relative, any base) targets an /api/* route. */
export function isDemoRequest(url: string | URL | Request): boolean {
  const u = parseUrl(urlOf(url))
  return !!u && isApiPath(u.pathname)
}

const abortError = () => new DOMException('The operation was aborted.', 'AbortError')

function delay(ms: number, signal: AbortSignal | null | undefined): Promise<void> {
  if (signal?.aborted) return Promise.reject(abortError())
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(abortError())
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function readBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  let raw: unknown = init?.body
  if (raw === undefined && typeof Request !== 'undefined' && input instanceof Request) {
    raw = await input.clone().text().catch(() => '')
  }
  if (typeof raw !== 'string' || !raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

function toResponse(r: Routed): Response {
  if (r.status === 204 || r.status === 304) return new Response(null, { status: r.status })
  return new Response(JSON.stringify(r.body), {
    status: r.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Rahel-Demo': '1' },
  })
}

function makeDemoFetch(orig: FetchFn): FetchFn {
  return async (input, init) => {
    const raw = urlOf(input)
    if (!isDemoRequest(raw)) {
      demoStats.passthrough++
      return orig.call(globalThis, input, init)
    }
    demoStats.simulatedRequests++
    demoStats.blockedNetworkRequests++
    const method = init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
    demoStats.lastRequest = `${method.toUpperCase()} ${parseUrl(raw)?.pathname ?? raw}`
    const signal = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : null)
    const { minLatencyMs, maxLatencyMs } = config
    await delay(minLatencyMs + Math.random() * (maxLatencyMs - minLatencyMs), signal)
    const body = await readBody(input, init)
    let routed: Routed
    try {
      routed = route(method, raw, body)
    } catch {
      routed = { status: 500, body: { error: 'internal' } }
    }
    if (routed === NOT_FOUND || (routed.status === 404 && (routed.body as { error?: string }).error === 'not_found')) {
      demoStats.notFound++
    }
    if (signal?.aborted) throw abortError()
    return toResponse(routed)
  }
}

/**
 * Replaces globalThis.fetch (window.fetch in the browser) with the simulator and returns a
 * function that restores it. Reference counted and idempotent: calling install/restore twice
 * (React StrictMode) never breaks anything; the original is restored when the last one releases.
 */
export function installDemoFetch(): () => void {
  if (refs === 0) {
    original = globalThis.fetch
    wrapper = makeDemoFetch(original)
    globalThis.fetch = wrapper
  } else if (globalThis.fetch !== wrapper && original) {
    // somebody replaced fetch meanwhile (devtools, another lib): wrap their version again
    original = globalThis.fetch
    wrapper = makeDemoFetch(original)
    globalThis.fetch = wrapper
  }
  refs++
  let released = false
  return () => {
    if (released) return
    released = true
    refs = Math.max(0, refs - 1)
    if (refs === 0) {
      if (globalThis.fetch === wrapper && original) globalThis.fetch = original
      original = null
      wrapper = null
    }
  }
}

export const isDemoFetchInstalled = () => refs > 0
