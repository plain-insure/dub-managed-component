import type {
  ComponentSettings,
  Manager,
  MCEvent,
  Client,
} from '@managed-components/types'
import { Dub } from 'dub'
import { getCookie } from './utils'

const MC_COOKIE_NAME = 'mc_dub'
const DUB_CLICK_ID_COOKIE = 'dub_id'

const handleCookieData = (client: Client, customerId?: string) => {
  const cookie = client.get(MC_COOKIE_NAME)
  let cookieData: { [k: string]: string | undefined } = {}

  const setFreshCookie = () => {
    const sessionId = crypto.randomUUID()

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
      client.set(MC_COOKIE_NAME, encodeURIComponent(JSON.stringify(cookieData)))
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

  const leadData = {
    clickId: clickId || '',
    eventName: payload.eventName || event.name || 'Lead',
    customerExternalId: customerId,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    customerAvatar: payload.customerAvatar,
    eventQuantity: payload.eventQuantity,
    metadata: payload.metadata,
  }

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

  const saleData = {
    customerExternalId: customerId,
    amount: payload.amount || payload.revenue || 0,
    currency: payload.currency,
    eventName: payload.eventName || event.name || 'Sale',
    paymentProcessor: payload.paymentProcessor,
    invoiceId: payload.invoiceId || payload.transactionId,
    metadata: payload.metadata,
    leadEventName: payload.leadEventName,
    clickId,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    customerAvatar: payload.customerAvatar,
  }

  await dub.track.sale(saleData)
}

export default async (manager: Manager, settings: ComponentSettings) => {
  // Initialize Dub SDK
  const dub = new Dub({
    token: settings.DUB_API_KEY,
  })

  // Event: pageview
  manager.addEventListener('pageview', async (event: MCEvent) => {
    console.info('"pageview" event received')
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
