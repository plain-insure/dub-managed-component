import type {
  ComponentSettings,
  Manager,
  MCEvent,
  Client,
} from '@managed-components/types'
import { Dub } from 'dub'
import { PaymentProcessor } from 'dub/models/components'
import { HTTPClient, type Fetcher } from 'dub/lib/http'
import { getCookie } from './utils'

const MC_COOKIE_NAME = 'mc_dub'
const DUB_CLICK_ID_COOKIE = 'dub_id'
const DEFAULT_DUB_API_HOST = 'https://api.dub.co'
// Same default Dub's own client script uses for how long a click stays
// attributable. See: https://dub.co/docs/sdks/client-side/installation-guides/manual
const CLICK_COOKIE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const DEFAULT_CLICK_QUERY_PARAM = 'via'

// Cloudflare Worker deployments of this component (via
// managed-component-to-cloudflare-worker, see `pnpm run release`) replace
// the global `fetch` with one that always errors, specifically to force
// components to make outbound requests through `manager.fetch` instead
// (WebCM and other MC hosts implement this the same way). This adapts
// `manager.fetch` into the `Fetcher` shape the Dub SDK expects, so both the
// SDK's own HTTP calls and our own click-tracking request below go through
// the sanctioned path rather than a bare `fetch()` that would silently fail
// once deployed.
const createManagerFetcher = (manager: Manager): Fetcher => {
  return async (input, init) => {
    const response = await manager.fetch(input, init)
    if (!response) {
      throw new Error('manager.fetch did not return a response')
    }
    return response
  }
}

const handleCookieData = (client: Client, customerId?: string) => {
  const cookie = client.get(MC_COOKIE_NAME)
  let cookieData: { [k: string]: string | undefined } = {}

  const generateId = () => {
    // Use crypto.randomUUID if available, otherwise fallback to a simple UUID v4 implementation
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    // Fallback UUID v4 generator for environments without crypto.randomUUID
    // Note: This uses Math.random() which is not cryptographically secure
    // However, this is only used for session tracking (not security purposes)
    // and only as a fallback for older environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const setFreshCookie = () => {
    const sessionId = generateId()

    cookieData = {
      sessionId,
      customerId,
    }

    client.set(MC_COOKIE_NAME, encodeURIComponent(JSON.stringify(cookieData)), {
      scope: 'infinite',
    })
  }

  if (cookie) {
    try {
      cookieData = JSON.parse(decodeURIComponent(cookie))
    } catch {
      setFreshCookie()
    }

    if (!cookieData?.sessionId) {
      setFreshCookie()
    } else if (customerId && !cookieData.customerId) {
      // add customerId to cookie if cookie already exists
      cookieData.customerId = customerId
      client.set(
        MC_COOKIE_NAME,
        encodeURIComponent(JSON.stringify(cookieData)),
        {
          scope: 'infinite',
        }
      )
    }
  } else {
    setFreshCookie()
  }

  return cookieData
}

const getClickId = (client: Client): string | undefined => {
  // Try to get click ID from dub_id cookie
  const cookieString = client.get('cookie') || ''
  return getCookie(cookieString, DUB_CLICK_ID_COOKIE)
}

const getCustomerId = (event: MCEvent): string => {
  const { client, payload } = event
  const { customerId, customerExternalId } = payload
  const cookieData = handleCookieData(client, customerId || customerExternalId)

  return (
    customerId ||
    customerExternalId ||
    cookieData.customerId ||
    cookieData.sessionId ||
    'anonymous'
  )
}

// Track a lead event
export const trackLeadEvent = async (
  dub: Dub,
  event: MCEvent
): Promise<void> => {
  const { client, payload } = event
  const clickId = getClickId(client)
  const customerId = getCustomerId(event)

  // Dub's /track/lead requires a real clickId. An empty string is only
  // meaningful as the second step of the "deferred" lead flow (mode:
  // "deferred" first, then a follow-up call with clickId: ""), which this
  // component doesn't implement. Without a clickId there's no click for
  // Dub to attribute the lead to, so skip rather than send a request Dub
  // can't resolve (this is expected for most direct/organic traffic that
  // didn't arrive via a Dub link).
  if (!clickId) {
    console.info(
      'Skipping lead event: no dub_id click ID found for this visitor'
    )
    return
  }

  const leadData: {
    clickId: string
    eventName: string
    customerExternalId: string
    customerName?: string
    customerEmail?: string
    customerAvatar?: string
    eventQuantity?: number
    metadata?: Record<string, unknown>
  } = {
    clickId,
    eventName: payload.eventName || event.name || 'Lead',
    customerExternalId: customerId,
  }

  // Only add optional fields if they have values
  if (payload.customerName) leadData.customerName = payload.customerName
  if (payload.customerEmail) leadData.customerEmail = payload.customerEmail
  if (payload.customerAvatar) leadData.customerAvatar = payload.customerAvatar
  if (payload.eventQuantity) leadData.eventQuantity = payload.eventQuantity
  if (payload.metadata) leadData.metadata = payload.metadata

  await dub.track.lead(leadData)
}

// Track a sale event
export const trackSaleEvent = async (
  dub: Dub,
  event: MCEvent
): Promise<void> => {
  const { client, payload } = event
  const clickId = getClickId(client)
  const customerId = getCustomerId(event)

  const saleData: {
    customerExternalId: string
    amount: number
    currency?: string
    eventName?: string
    paymentProcessor?: PaymentProcessor
    invoiceId?: string
    metadata?: Record<string, unknown>
    leadEventName?: string
    clickId?: string
    customerName?: string
    customerEmail?: string
    customerAvatar?: string
  } = {
    customerExternalId: customerId,
    amount: payload.amount || payload.revenue || 0,
  }

  // Only add optional fields if they have values
  if (payload.currency) saleData.currency = payload.currency
  if (payload.eventName || event.name)
    saleData.eventName = payload.eventName || event.name || 'Sale'
  // Dub only accepts a closed set of payment processor values. An
  // unrecognized value would otherwise fail SDK validation and cause the
  // entire sale event to be dropped, so only forward it if it's valid.
  if (
    payload.paymentProcessor &&
    Object.values(PaymentProcessor).includes(
      payload.paymentProcessor as PaymentProcessor
    )
  ) {
    saleData.paymentProcessor = payload.paymentProcessor as PaymentProcessor
  }
  if (payload.invoiceId || payload.transactionId)
    saleData.invoiceId = payload.invoiceId || payload.transactionId
  if (payload.metadata) saleData.metadata = payload.metadata
  if (payload.leadEventName) saleData.leadEventName = payload.leadEventName
  if (clickId) saleData.clickId = clickId
  if (payload.customerName) saleData.customerName = payload.customerName
  if (payload.customerEmail) saleData.customerEmail = payload.customerEmail
  if (payload.customerAvatar) saleData.customerAvatar = payload.customerAvatar

  await dub.track.sale(saleData)
}

const setClickIdCookie = (client: Client, clickId: string): void => {
  client.set(DUB_CLICK_ID_COOKIE, clickId, {
    scope: 'infinite',
    expiry: new Date(Date.now() + CLICK_COOKIE_MAX_AGE_MS),
  })
}

// Which query params (in addition to the default "via") to check for a
// short link key, e.g. "?via=abc123". Configurable via DUB_QUERY_PARAMS as
// either a JSON array or a comma-separated list.
const getClickQueryParams = (settings: ComponentSettings): string[] => {
  const raw = settings.DUB_QUERY_PARAMS
  const params: string[] = []

  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) params.push(...parsed.map(String))
    } catch {
      params.push(
        ...String(raw)
          .split(',')
          .map((param) => param.trim())
          .filter(Boolean)
      )
    }
  }

  if (!params.includes(DEFAULT_CLICK_QUERY_PARAM)) {
    params.push(DEFAULT_CLICK_QUERY_PARAM)
  }

  return params
}

// Calls Dub's click-tracking endpoint directly — the same public endpoint
// Dub's own client-side script posts to (no API key required) — and
// returns the resulting clickId, if any. Uses manager.fetch rather than a
// bare fetch() — see createManagerFetcher above for why.
// See: https://dub.co/docs/sdks/client-side/installation-guides/manual
const recordClick = async (
  manager: Manager,
  settings: ComponentSettings,
  domain: string,
  key: string,
  url: string,
  referrer: string
): Promise<string | undefined> => {
  const apiHost = settings.DUB_API_HOST || DEFAULT_DUB_API_HOST

  try {
    const response = await manager.fetch(`${apiHost}/track/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, key, url, referrer }),
    })

    if (!response) {
      console.error('Dub click tracking request could not be sent')
      return undefined
    }

    if (!response.ok) {
      console.error(`Dub click tracking request failed: ${response.status}`)
      return undefined
    }

    const data = (await response.json()) as { clickId?: string }
    return data.clickId
  } catch (error) {
    console.error('Failed to record Dub click:', error)
    return undefined
  }
}

// Detect and record a click for the current pageview, and store the
// resulting clickId in the dub_id cookie ourselves — no client-side script
// involved. Running this on every 'pageview' event (including client-side
// navigations, which the host page/Zaraz also surface as 'pageview') means
// SPA route changes are picked up too, not just the initial hard load.
export const trackClick = async (
  event: MCEvent,
  settings: ComponentSettings,
  manager: Manager
): Promise<void> => {
  const { client } = event
  const url = client.url

  const existingClickId = getClickId(client)
  const attributionModel = settings.DUB_ATTRIBUTION_MODEL || 'last-click'
  // Once a click is attributed, only a later click can override it under
  // "last-click"; "first-click" keeps the original for the whole cookie
  // lifetime.
  if (existingClickId && attributionModel === 'first-click') return

  // Case 1: the visitor arrived via an actual Dub short-link redirect,
  // which appends `?dub_id=<clickId>` to the destination URL — Dub already
  // recorded the click, we just need to persist it.
  const dubIdParam = url.searchParams.get(DUB_CLICK_ID_COOKIE)
  if (dubIdParam) {
    setClickIdCookie(client, dubIdParam)
    return
  }

  // Case 2: a "via"-style query param naming a short link key on your own
  // configured domain (e.g. yoursite.com/?via=abc123, bypassing an actual
  // short-domain redirect) — record the click ourselves.
  const domain = settings.DUB_SHORT_DOMAIN
  if (!domain) return

  const key = getClickQueryParams(settings)
    .map((param) => url.searchParams.get(param))
    .find((value): value is string => Boolean(value))
  if (!key) return

  const clickId = await recordClick(
    manager,
    settings,
    domain,
    key,
    url.toString(),
    client.referer || ''
  )
  if (clickId) setClickIdCookie(client, clickId)
}

export default async (manager: Manager, settings: ComponentSettings) => {
  // Initialize Dub SDK. Route its HTTP calls through manager.fetch instead
  // of its default bare fetch() — see createManagerFetcher above.
  const dub = new Dub({
    token: settings.DUB_API_KEY,
    httpClient: new HTTPClient({ fetcher: createManagerFetcher(manager) }),
  })

  // Event: pageview
  manager.addEventListener('pageview', async (event: MCEvent) => {
    console.info('"pageview" event received')
    try {
      // Detect and record a click for this pageview (or SPA navigation)
      // and set the dub_id cookie ourselves — see trackClick.
      await trackClick(event, settings, manager)
    } catch (error) {
      console.error('Failed to track click:', error)
    }
    try {
      // Track pageview as a lead event
      await trackLeadEvent(dub, {
        ...event,
        payload: {
          ...event.payload,
          eventName: 'Pageview',
        },
      })
    } catch (error) {
      console.error('Failed to track pageview:', error)
    }
  })

  // Event: event (generic custom event)
  manager.addEventListener('event', async (event: MCEvent) => {
    console.info('"event" event received')
    try {
      // Determine if this is a sale or lead event based on payload
      if (event.payload.amount || event.payload.revenue) {
        await trackSaleEvent(dub, event)
      } else {
        await trackLeadEvent(dub, event)
      }
    } catch (error) {
      console.error('Failed to track event:', error)
    }
  })

  // Event: track
  manager.addEventListener('track', async (event: MCEvent) => {
    console.info('"track" event received')
    try {
      // Determine if this is a sale or lead event based on payload
      if (event.payload.amount || event.payload.revenue) {
        await trackSaleEvent(dub, event)
      } else {
        await trackLeadEvent(dub, event)
      }
    } catch (error) {
      console.error('Failed to track event:', error)
    }
  })

  // Event: ecommerce (for ecommerce transactions)
  manager.addEventListener('ecommerce', async (event: MCEvent) => {
    console.info('"ecommerce" event received')
    try {
      await trackSaleEvent(dub, event)
    } catch (error) {
      console.error('Failed to track ecommerce event:', error)
    }
  })

  // Event: identify (to associate a user with their ID)
  manager.addEventListener('identify', async (event: MCEvent) => {
    console.info('"identify" event received')
    try {
      // Store the customer ID in the cookie
      const customerId =
        event.payload.customerId || event.payload.customerExternalId
      if (customerId) {
        handleCookieData(event.client, customerId)
      }
    } catch (error) {
      console.error('Failed to identify user:', error)
    }
  })
}
