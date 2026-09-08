import type {
  ComponentSettings,
  Manager,
  MCEvent,
  Client,
} from '@managed-components/types'
import { Dub } from 'dub'
import { HTTPClient } from 'dub/lib/http'
import { PaymentProcessor } from 'dub/models/components'
import { getCookie } from './utils'

const MC_COOKIE_NAME = 'mc_dub'
const DUB_CLICK_ID_COOKIE = 'dub_id'
const DUB_PARTNER_DATA_COOKIE = 'dub_partner_data'
const DEFAULT_DUB_API_HOST = 'https://api.dub.co'
// Same default Dub's own client script uses for how long a click stays
// attributable. See: https://dub.co/docs/sdks/client-side/installation-guides/manual
const CLICK_COOKIE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
const DEFAULT_CLICK_QUERY_PARAM = 'via'
const CONVERSION_CONFIRMED_EVENT = 'plain:dub-conversion-confirmed'

const isDebugEnabled = (settings: ComponentSettings): boolean => {
  return settings.DUB_DEBUG === 'true'
}

const isClickIdDebugEnabled = (settings: ComponentSettings): boolean => {
  return isDebugEnabled(settings) && settings.DUB_DEBUG_SHOW_CLICK_ID === 'true'
}

const debug = (enabled: boolean, message: string): void => {
  if (enabled) console.info(`[Dub] ${message}`)
}

const debugOnClient = (
  client: Client,
  enabled: boolean,
  message: string
): void => {
  if (enabled)
    client.execute(`console.info(${JSON.stringify(`[Dub] ${message}`)})`)
}

const debugClickId = (client: Client, settings: ComponentSettings): void => {
  if (!isClickIdDebugEnabled(settings)) return

  const clickId = getClickId(client)
  const message = clickId
    ? `Pageview on ${client.url.hostname}: click ID ${clickId}`
    : `Pageview on ${client.url.hostname}: no click ID`
  debug(true, message)
  debugOnClient(client, true, message)
}

const createManagerHttpClient = (
  manager: Manager,
  debugEnabled: boolean
): HTTPClient => {
  return new HTTPClient({
    fetcher: async (input, init) => {
      const request = new Request(input, init)
      debug(
        debugEnabled,
        `Sending ${request.method} request to ${new URL(request.url).pathname}`
      )
      const response = await manager.fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      })

      if (!response) {
        throw new Error('Dub conversion request could not be sent')
      }

      debug(
        debugEnabled,
        `Dub conversion request completed with ${response.status}`
      )
      return response
    },
  })
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
  return (
    client.get(DUB_CLICK_ID_COOKIE) ||
    getCookie(client.get('cookie') || '', DUB_CLICK_ID_COOKIE)
  )
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

const confirmConversion = (event: MCEvent, sent: boolean): void => {
  const conversionId = event.payload.plainDubConversionId
  if (typeof conversionId !== 'string' || !conversionId) return

  event.client.execute(
    `window.dispatchEvent(new CustomEvent(${JSON.stringify(CONVERSION_CONFIRMED_EVENT)}, { detail: ${JSON.stringify({ conversionId, sent })} }))`
  )
}

// Track a lead event
export const trackLeadEvent = async (
  dub: Dub,
  event: MCEvent
): Promise<boolean> => {
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
    return false
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
  return true
}

// Track a sale event
export const trackSaleEvent = async (
  dub: Dub,
  event: MCEvent
): Promise<boolean> => {
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
  return true
}

const hasSaleAmount = (event: MCEvent): boolean => {
  const { amount, revenue } = event.payload
  return amount !== undefined || revenue !== undefined
}

const trackConversionEvent = async (
  dub: Dub,
  event: MCEvent,
  isSale = false
): Promise<boolean> => {
  if (isSale || hasSaleAmount(event)) {
    return trackSaleEvent(dub, event)
  }

  return trackLeadEvent(dub, event)
}

const setClickCookies = (
  client: Client,
  clickId: string,
  partnerData?: Record<string, unknown>
): boolean => {
  const clickIdStored = client.set(DUB_CLICK_ID_COOKIE, clickId, {
    scope: 'infinite',
    expiry: new Date(Date.now() + CLICK_COOKIE_MAX_AGE_MS),
  })
  if (partnerData) {
    client.set(
      DUB_PARTNER_DATA_COOKIE,
      JSON.stringify({ clickId, ...partnerData }),
      {
        scope: 'infinite',
        expiry: new Date(Date.now() + CLICK_COOKIE_MAX_AGE_MS),
      }
    )
  }

  return Boolean(clickIdStored)
}

const debugClickIdAvailability = (
  client: Client,
  debugEnabled: boolean,
  eventType: string
): void => {
  const message = getClickId(client)
    ? `${eventType} received on ${client.url.hostname}: click ID is available`
    : `${eventType} received on ${client.url.hostname}: click ID is not available`
  debug(debugEnabled, message)
  debugOnClient(client, debugEnabled, message)
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
  referrer: string,
  onDiagnostic: (message: string) => void
): Promise<
  | { clickId: string; partner?: Record<string, unknown>; discount?: unknown }
  | undefined
> => {
  const apiHost = settings.DUB_API_HOST || DEFAULT_DUB_API_HOST

  try {
    const response = await manager.fetch(`${apiHost}/track/click`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: url,
      },
      body: JSON.stringify({ domain, key, url, referrer }),
    })

    if (!response) {
      console.error('Dub click tracking request could not be sent')
      onDiagnostic('Click API request could not be sent')
      return undefined
    }

    if (!response.ok) {
      console.error(`Dub click tracking request failed: ${response.status}`)
      onDiagnostic(`Click API request failed with ${response.status}`)
      return undefined
    }

    const data = (await response.json()) as {
      clickId?: string
      partner?: Record<string, unknown>
      discount?: unknown
    }
    if (!data.clickId) {
      onDiagnostic(
        `Click API response ${response.status} did not include a click ID`
      )
      return undefined
    }

    return { ...data, clickId: data.clickId }
  } catch (error) {
    console.error('Failed to record Dub click:', error)
    onDiagnostic('Click API request failed before a response was received')
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
  const debugEnabled = isDebugEnabled(settings)

  const existingClickId = getClickId(client)
  const attributionModel = settings.DUB_ATTRIBUTION_MODEL || 'last-click'
  // Once a click is attributed, only a later click can override it under
  // "last-click"; "first-click" keeps the original for the whole cookie
  // lifetime.
  if (existingClickId && attributionModel === 'first-click') {
    debug(debugEnabled, 'Click tracking skipped: preserving first click')
    debugOnClient(
      client,
      debugEnabled,
      'Click tracking skipped: preserving first click'
    )
    return
  }

  // Case 1: the visitor arrived via an actual Dub short-link redirect,
  // which appends `?dub_id=<clickId>` to the destination URL — Dub already
  // recorded the click, we just need to persist it.
  const dubIdParam = url.searchParams.get(DUB_CLICK_ID_COOKIE)
  if (dubIdParam) {
    const stored = setClickCookies(client, dubIdParam)
    const message = stored
      ? 'Stored click ID supplied by a Dub redirect'
      : 'Could not store click ID: access to client key-value storage is not granted'
    debug(debugEnabled, message)
    debugOnClient(client, debugEnabled, message)
    return
  }

  // Case 2: a "via"-style query param naming a short link key on your own
  // configured domain (e.g. yoursite.com/?via=abc123, bypassing an actual
  // short-domain redirect) — record the click ourselves.
  const domain = settings.DUB_SHORT_DOMAIN
  if (!domain) {
    debug(debugEnabled, 'Click tracking skipped: DUB_SHORT_DOMAIN is not set')
    debugOnClient(
      client,
      debugEnabled,
      'Click tracking skipped: DUB_SHORT_DOMAIN is not set'
    )
    return
  }

  const key = getClickQueryParams(settings)
    .map((param) => url.searchParams.get(param))
    .find((value): value is string => Boolean(value))
  if (!key) {
    debug(debugEnabled, 'Click tracking skipped: no configured link key found')
    debugOnClient(
      client,
      debugEnabled,
      'Click tracking skipped: no configured link key found'
    )
    return
  }

  debug(debugEnabled, `Recording click for configured domain ${domain}`)
  debugOnClient(
    client,
    debugEnabled,
    `Recording click for configured domain ${domain}`
  )
  const click = await recordClick(
    manager,
    settings,
    domain,
    key,
    url.toString(),
    client.referer || '',
    (message) => {
      debug(debugEnabled, message)
      debugOnClient(client, debugEnabled, message)
    }
  )
  if (click) {
    const stored = setClickCookies(client, click.clickId, {
      partner: click.partner,
      discount: click.discount,
    })
    const message = stored
      ? 'Click recorded and click ID stored'
      : 'Click recorded but the click ID could not be stored'
    debug(debugEnabled, message)
    debugOnClient(client, debugEnabled, message)
  } else {
    debug(debugEnabled, 'Click was not recorded')
    debugOnClient(client, debugEnabled, 'Click was not recorded')
  }
}

export default async (manager: Manager, settings: ComponentSettings) => {
  const debugEnabled = isDebugEnabled(settings)
  // Dub's conversion APIs select a workspace from the API key. Click
  // tracking below remains unauthenticated and selects it by short domain.
  const dub = settings.DUB_API_KEY
    ? new Dub({
        token: settings.DUB_API_KEY,
        httpClient: createManagerHttpClient(manager, debugEnabled),
      })
    : undefined

  debug(
    debugEnabled,
    dub
      ? 'Conversion tracking initialized'
      : 'Conversion tracking disabled: DUB_API_KEY is not set'
  )

  // Event: pageview
  manager.addEventListener('pageview', async (event: MCEvent) => {
    debug(debugEnabled, 'Pageview received')
    debugOnClient(event.client, debugEnabled, 'Pageview received')
    try {
      await trackClick(event, settings, manager)
      debugClickId(event.client, settings)
    } catch (error) {
      console.error('Failed to track click:', error)
    }
  })

  if (!dub) return

  const handleConversionEvent = async (
    event: MCEvent,
    isSale = false
  ): Promise<void> => {
    try {
      debugClickIdAvailability(
        event.client,
        debugEnabled,
        isSale ? 'Ecommerce event' : 'Conversion event'
      )
      debug(
        debugEnabled,
        isSale || hasSaleAmount(event)
          ? 'Sending sale conversion event'
          : 'Sending lead conversion event'
      )
      const sent = await trackConversionEvent(dub, event, isSale)
      confirmConversion(event, sent)
    } catch (error) {
      console.error('Failed to track Dub conversion:', error)
      confirmConversion(event, false)
    }
  }

  manager.addEventListener('event', handleConversionEvent)
  manager.addEventListener('track', handleConversionEvent)
  manager.addEventListener('ecommerce', async (event: MCEvent) => {
    await handleConversionEvent(event, true)
  })
}
