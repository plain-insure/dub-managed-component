/* eslint-disable  @typescript-eslint/no-explicit-any */
import type { MCEvent } from '@managed-components/types'
import { trackLeadEvent, trackSaleEvent } from '.'

// Mock Dub SDK
const mockTrackLead = vi.fn()
const mockTrackSale = vi.fn()

const mockDub = {
  track: {
    lead: mockTrackLead,
    sale: mockTrackSale,
  },
}

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

  it('tracks a lead event with empty clickId when not available', async () => {
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

    expect(mockTrackLead).toHaveBeenCalledTimes(1)
    const callArgs = mockTrackLead.mock.calls[0][0]
    expect(callArgs.clickId).toEqual('')
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
