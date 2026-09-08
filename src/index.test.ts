/* eslint-disable  @typescript-eslint/no-explicit-any */
import type { MCEvent, Manager } from '@managed-components/types'

const { mockDub, mockDubConstructor, mockTrackLead, mockTrackSale } =
  vi.hoisted(() => {
    const trackLead = vi.fn()
    const trackSale = vi.fn()
    const dub = {
      track: {
        lead: trackLead,
        sale: trackSale,
      },
    }

    return {
      mockDub: dub,
      mockDubConstructor: vi.fn(() => dub),
      mockTrackLead: trackLead,
      mockTrackSale: trackSale,
    }
  })

vi.mock('dub', () => ({ Dub: mockDubConstructor }))

import component, { trackLeadEvent, trackSaleEvent, trackClick } from '.'

const dummyClient = {
  emitter: 'browser',
  url: new URL('http://example.com/page'),
  title: 'Test Page',
  timestamp: 1712444841992,
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  language: 'en-US',
  referer: new URL('https://www.google.com/'),
  ip: '127.0.0.1',
  screenWidth: 1920,
  screenHeight: 1080,
  viewportWidth: 1440,
  viewportHeight: 900,
  fetch: () => undefined,
  set: () => undefined,
  execute: () => undefined,
  return: () => undefined,
  get: (key: string) => {
    if (key === 'dub_id') {
      return 'click123'
    }
    if (key === 'cookie') {
      return 'dub_id=click123; other=value'
    }
    if (key === 'mc_dub') {
      return encodeURIComponent(
        JSON.stringify({
          sessionId: 'session123',
          customerId: 'customer456',
        })
      )
    }
    return undefined
  },
  attachEvent: () => undefined,
  detachEvent: () => undefined,
}

describe('Dub MC track lead event handler works correctly', () => {
  beforeEach(() => {
    mockTrackLead.mockClear()
  })

  it('tracks a lead event with all required fields', async () => {
    const fakeEvent = new Event('track', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      eventName: 'Sign Up',
      customerExternalId: 'user123',
      customerEmail: 'user@example.com',
      customerName: 'John Doe',
    }
    fakeEvent.client = dummyClient

    await trackLeadEvent(mockDub as any, fakeEvent)

    expect(mockTrackLead).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackLead.mock.calls[0][0]
    expect(callArgs.eventName).toEqual('Sign Up')
    expect(callArgs.clickId).toEqual('click123')
    expect(callArgs.customerExternalId).toEqual('user123')
    expect(callArgs.customerEmail).toEqual('user@example.com')
    expect(callArgs.customerName).toEqual('John Doe')
  })

  it('tracks a lead event with default event name', async () => {
    const fakeEvent = new Event('track', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      customerExternalId: 'user123',
    }
    fakeEvent.client = dummyClient
    fakeEvent.name = 'Custom Lead Event'

    await trackLeadEvent(mockDub as any, fakeEvent)

    expect(mockTrackLead).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackLead.mock.calls[0][0]
    expect(callArgs.eventName).toEqual('Custom Lead Event')
  })

  it('skips tracking when no clickId is available', async () => {
    const fakeEvent = new Event('track', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      eventName: 'Lead',
      customerExternalId: 'user123',
    }
    fakeEvent.client = {
      ...dummyClient,
      get: () => undefined,
    }

    await trackLeadEvent(mockDub as any, fakeEvent)

    // Dub's /track/lead requires a real clickId; an empty string is only
    // valid inside the "deferred" lead flow, which isn't implemented here,
    // so the event should be skipped rather than sent with clickId: ''.
    expect(mockTrackLead).not.toHaveBeenCalled()
  })

  it('includes metadata when provided', async () => {
    const fakeEvent = new Event('track', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      eventName: 'Form Submit',
      customerExternalId: 'user123',
      metadata: {
        formName: 'Contact Form',
        source: 'landing-page',
      },
    }
    fakeEvent.client = dummyClient

    await trackLeadEvent(mockDub as any, fakeEvent)

    expect(mockTrackLead).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackLead.mock.calls[0][0]
    expect(callArgs.metadata).toEqual({
      formName: 'Contact Form',
      source: 'landing-page',
    })
  })
})

describe('Dub MC track sale event handler works correctly', () => {
  beforeEach(() => {
    mockTrackSale.mockClear()
  })

  it('tracks a sale event with all required fields', async () => {
    const fakeEvent = new Event('ecommerce', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      eventName: 'Purchase',
      customerExternalId: 'user123',
      amount: 9999,
      currency: 'USD',
      invoiceId: 'inv_123',
    }
    fakeEvent.client = dummyClient

    await trackSaleEvent(mockDub as any, fakeEvent)

    expect(mockTrackSale).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackSale.mock.calls[0][0]
    expect(callArgs.eventName).toEqual('Purchase')
    expect(callArgs.customerExternalId).toEqual('user123')
    expect(callArgs.amount).toEqual(9999)
    expect(callArgs.currency).toEqual('USD')
    expect(callArgs.invoiceId).toEqual('inv_123')
    expect(callArgs.clickId).toEqual('click123')
  })

  it('tracks a sale event with revenue field as fallback for amount', async () => {
    const fakeEvent = new Event('ecommerce', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      eventName: 'Subscription',
      customerExternalId: 'user456',
      revenue: 2999,
      currency: 'EUR',
    }
    fakeEvent.client = dummyClient

    await trackSaleEvent(mockDub as any, fakeEvent)

    expect(mockTrackSale).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackSale.mock.calls[0][0]
    expect(callArgs.amount).toEqual(2999)
  })

  it('includes payment processor when provided', async () => {
    const fakeEvent = new Event('ecommerce', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      eventName: 'Payment Received',
      customerExternalId: 'user123',
      amount: 5000,
      paymentProcessor: 'stripe',
    }
    fakeEvent.client = dummyClient

    await trackSaleEvent(mockDub as any, fakeEvent)

    expect(mockTrackSale).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackSale.mock.calls[0][0]
    expect(callArgs.paymentProcessor).toEqual('stripe')
  })

  it('omits an invalid payment processor instead of dropping the event', async () => {
    const fakeEvent = new Event('ecommerce', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      eventName: 'Payment Received',
      customerExternalId: 'user123',
      amount: 5000,
      paymentProcessor: 'not-a-real-processor',
    }
    fakeEvent.client = dummyClient

    await trackSaleEvent(mockDub as any, fakeEvent)

    expect(mockTrackSale).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackSale.mock.calls[0][0]
    expect(callArgs.paymentProcessor).toBeUndefined()
  })

  it('includes lead event name for attribution', async () => {
    const fakeEvent = new Event('ecommerce', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      eventName: 'Conversion',
      customerExternalId: 'user123',
      amount: 15000,
      leadEventName: 'Free Trial Started',
    }
    fakeEvent.client = dummyClient

    await trackSaleEvent(mockDub as any, fakeEvent)

    expect(mockTrackSale).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackSale.mock.calls[0][0]
    expect(callArgs.leadEventName).toEqual('Free Trial Started')
  })

  it('uses transactionId as fallback for invoiceId', async () => {
    const fakeEvent = new Event('ecommerce', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      eventName: 'Purchase',
      customerExternalId: 'user123',
      amount: 10000,
      transactionId: 'txn_abc123',
    }
    fakeEvent.client = dummyClient

    await trackSaleEvent(mockDub as any, fakeEvent)

    expect(mockTrackSale).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackSale.mock.calls[0][0]
    expect(callArgs.invoiceId).toEqual('txn_abc123')
  })

  it('includes metadata when provided', async () => {
    const fakeEvent = new Event('ecommerce', {}) as unknown as MCEvent
    // @ts-expect-error - payload is read only
    fakeEvent.payload = {
      eventName: 'Purchase',
      customerExternalId: 'user123',
      amount: 7500,
      metadata: {
        productId: 'prod_123',
        plan: 'premium',
        quantity: 2,
      },
    }
    fakeEvent.client = dummyClient

    await trackSaleEvent(mockDub as any, fakeEvent)

    expect(mockTrackSale).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackSale.mock.calls[0][0]
    expect(callArgs.metadata).toEqual({
      productId: 'prod_123',
      plan: 'premium',
      quantity: 2,
    })
  })
})

describe('Dub MC click tracking works correctly', () => {
  // Real deployments (see managed-component-to-cloudflare-worker, used by
  // `pnpm run release`) disable the global fetch() and require outbound
  // requests to go through manager.fetch instead, so that's what trackClick
  // is exercised with here rather than a stubbed global fetch.
  const mockManagerFetch = vi.fn()
  const mockManager = { fetch: mockManagerFetch } as unknown as Manager

  const clickClient = (url: string, cookie = '') => ({
    ...dummyClient,
    url: new URL(url),
    referer: 'https://www.google.com/',
    set: vi.fn(),
    get: (key: string) =>
      key === 'dub_id' ? getCookieValue(cookie, 'dub_id') : undefined,
  })

  const getCookieValue = (cookie: string, name: string) =>
    cookie
      .split(';')
      .map((part) => part.trim().split('='))
      .find(([key]) => key === name)?.[1]

  beforeEach(() => {
    mockManagerFetch.mockReset()
  })

  it('persists an existing dub_id query param directly, without calling the API', async () => {
    const client = clickClient('https://example.com/?dub_id=click_abc')
    const fakeEvent = { client, payload: {} } as unknown as MCEvent

    await trackClick(fakeEvent, {}, mockManager)

    expect(mockManagerFetch).not.toHaveBeenCalled()
    expect(client.set).toHaveBeenCalledWith(
      'dub_id',
      'click_abc',
      expect.objectContaining({ scope: 'infinite' })
    )
  })

  it('calls /track/click directly for a via param when a short domain is configured', async () => {
    const client = clickClient('https://example.com/?via=partner123')
    const fakeEvent = { client, payload: {} } as unknown as MCEvent
    mockManagerFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        clickId: 'click_xyz',
        partner: { id: 'pn_123', name: 'Partner' },
      }),
    })

    await trackClick(
      fakeEvent,
      { DUB_SHORT_DOMAIN: 'example.link' },
      mockManager
    )

    expect(mockManagerFetch).toHaveBeenCalledWith(
      'https://api.dub.co/track/click',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Referer: 'https://example.com/?via=partner123',
        },
        body: JSON.stringify({
          domain: 'example.link',
          key: 'partner123',
          url: 'https://example.com/?via=partner123',
          referrer: 'https://www.google.com/',
        }),
      })
    )
    expect(client.set).toHaveBeenCalledWith(
      'dub_id',
      'click_xyz',
      expect.objectContaining({ scope: 'infinite' })
    )
    expect(client.set).toHaveBeenCalledWith(
      'dub_partner_data',
      JSON.stringify({
        clickId: 'click_xyz',
        partner: { id: 'pn_123', name: 'Partner' },
      }),
      expect.objectContaining({ scope: 'infinite' })
    )
  })

  it('does nothing when there is no dub_id param and no short domain configured', async () => {
    const client = clickClient('https://example.com/?via=partner123')
    const fakeEvent = { client, payload: {} } as unknown as MCEvent

    await trackClick(fakeEvent, {}, mockManager)

    expect(mockManagerFetch).not.toHaveBeenCalled()
    expect(client.set).not.toHaveBeenCalled()
  })

  it('writes a safe debug message to the browser console when enabled', async () => {
    const execute = vi.fn()
    const client = { ...clickClient('https://example.com/'), execute }
    const fakeEvent = { client, payload: {} } as unknown as MCEvent

    await trackClick(fakeEvent, { DUB_DEBUG: 'true' }, mockManager)

    expect(execute).toHaveBeenCalledWith(
      'console.info("[Dub] Click tracking skipped: DUB_SHORT_DOMAIN is not set")'
    )
  })

  it('reports when Zaraz cannot store a recorded click ID', async () => {
    const execute = vi.fn()
    const client = {
      ...clickClient('https://example.com/?via=partner123'),
      execute,
      set: () => undefined,
    }
    const fakeEvent = { client, payload: {} } as unknown as MCEvent
    mockManagerFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clickId: 'click_xyz' }),
    })

    await trackClick(
      fakeEvent,
      { DUB_SHORT_DOMAIN: 'example.link', DUB_DEBUG: 'true' },
      mockManager
    )

    expect(execute).toHaveBeenCalledWith(
      'console.info("[Dub] Click recorded but the click ID could not be stored")'
    )
  })

  it('does not overwrite an existing click under the first-click attribution model', async () => {
    const client = clickClient(
      'https://example.com/?dub_id=click_new',
      'dub_id=click_original'
    )
    const fakeEvent = { client, payload: {} } as unknown as MCEvent

    await trackClick(
      fakeEvent,
      { DUB_ATTRIBUTION_MODEL: 'first-click' },
      mockManager
    )

    expect(mockManagerFetch).not.toHaveBeenCalled()
    expect(client.set).not.toHaveBeenCalled()
  })

  it('overwrites an existing click under the default last-click attribution model', async () => {
    const client = clickClient(
      'https://example.com/?dub_id=click_new',
      'dub_id=click_original'
    )
    const fakeEvent = { client, payload: {} } as unknown as MCEvent

    await trackClick(fakeEvent, {}, mockManager)

    expect(client.set).toHaveBeenCalledWith(
      'dub_id',
      'click_new',
      expect.objectContaining({ scope: 'infinite' })
    )
  })

  it('does not set a cookie when the click API call fails', async () => {
    const execute = vi.fn()
    const client = {
      ...clickClient('https://example.com/?via=partner123'),
      execute,
    }
    const fakeEvent = { client, payload: {} } as unknown as MCEvent
    mockManagerFetch.mockResolvedValue({ ok: false, status: 500 })

    await trackClick(
      fakeEvent,
      { DUB_SHORT_DOMAIN: 'example.link', DUB_DEBUG: 'true' },
      mockManager
    )

    expect(client.set).not.toHaveBeenCalled()
    expect(execute).toHaveBeenCalledWith(
      'console.info("[Dub] Click API request failed with 500")'
    )
  })

  it('does not set a cookie when manager.fetch returns no response', async () => {
    const client = clickClient('https://example.com/?via=partner123')
    const fakeEvent = { client, payload: {} } as unknown as MCEvent
    mockManagerFetch.mockResolvedValue(undefined)

    await trackClick(
      fakeEvent,
      { DUB_SHORT_DOMAIN: 'example.link' },
      mockManager
    )

    expect(client.set).not.toHaveBeenCalled()
  })
})

describe('Dub MC listener registration', () => {
  beforeEach(() => {
    mockDubConstructor.mockClear()
    mockTrackLead.mockClear()
    mockTrackSale.mockClear()
  })

  it('uses the API key for conversion tracking and registers conversion listeners', async () => {
    const listeners = new Map<string, (event: MCEvent) => Promise<void>>()
    const fetch = vi.fn().mockResolvedValue(new Response())
    const execute = vi.fn()
    const addEventListener = vi.fn(
      (eventType: string, listener: (event: MCEvent) => Promise<void>) => {
        listeners.set(eventType, listener)
      }
    )

    await component({ addEventListener, fetch } as unknown as Manager, {
      DUB_API_KEY: 'dub_test_key',
    })

    expect(mockDubConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'dub_test_key',
        httpClient: expect.anything(),
      })
    )

    const { httpClient } = mockDubConstructor.mock.calls[0][0]
    await httpClient.request(
      new Request('https://api.dub.co/track/lead', {
        method: 'POST',
        body: '{}',
      })
    )

    expect(fetch).toHaveBeenCalledWith(
      'https://api.dub.co/track/lead',
      expect.objectContaining({ method: 'POST' })
    )
    expect(addEventListener).toHaveBeenCalledTimes(4)
    expect(addEventListener).toHaveBeenCalledWith(
      'pageview',
      expect.any(Function)
    )
    expect(addEventListener).toHaveBeenCalledWith('event', expect.any(Function))
    expect(addEventListener).toHaveBeenCalledWith('track', expect.any(Function))
    expect(addEventListener).toHaveBeenCalledWith(
      'ecommerce',
      expect.any(Function)
    )

    await listeners.get('track')?.({
      client: { ...dummyClient, execute },
      name: 'Registration',
      payload: {
        customerExternalId: 'user123',
        plainDubConversionId: 'conversion-123',
      },
    } as unknown as MCEvent)

    expect(mockTrackLead).toHaveBeenCalledWith(
      expect.objectContaining({
        clickId: 'click123',
        customerExternalId: 'user123',
        eventName: 'Registration',
      })
    )
    expect(execute).toHaveBeenCalledWith(
      'window.dispatchEvent(new CustomEvent("plain:dub-conversion-confirmed", { detail: {"conversionId":"conversion-123","sent":true} }))'
    )

    mockTrackLead.mockClear()
    await listeners.get('pageview')?.({
      client: dummyClient,
      payload: {},
    } as unknown as MCEvent)

    expect(mockTrackLead).not.toHaveBeenCalled()
  })

  it('logs the click ID on pageview only when explicitly enabled', async () => {
    const listeners = new Map<string, (event: MCEvent) => Promise<void>>()
    const addEventListener = vi.fn(
      (eventType: string, listener: (event: MCEvent) => Promise<void>) => {
        listeners.set(eventType, listener)
      }
    )
    const execute = vi.fn()

    await component({ addEventListener } as unknown as Manager, {
      DUB_DEBUG: 'true',
      DUB_DEBUG_SHOW_CLICK_ID: 'true',
    })

    await listeners.get('pageview')?.({
      client: { ...dummyClient, execute },
      payload: {},
    } as unknown as MCEvent)

    expect(execute).toHaveBeenCalledWith(
      'console.info("[Dub] Pageview on example.com: click ID click123")'
    )
  })

  it('does not initialize conversion tracking without an API key', async () => {
    const addEventListener = vi.fn()

    await component({ addEventListener } as unknown as Manager, {})

    expect(mockDubConstructor).not.toHaveBeenCalled()
    expect(addEventListener).toHaveBeenCalledTimes(1)
    expect(addEventListener).toHaveBeenCalledWith(
      'pageview',
      expect.any(Function)
    )
  })
})
