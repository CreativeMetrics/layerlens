// Best-effort recognition of GA4 / Google Ads / Meta / Bing UET / TikTok tracking
// pings among the requests observed for a page export. Pure parsing logic — no DOM/chrome APIs.

import { gcsToConsentState } from './consent'

export interface TrackingHit {
  url: string
  platform: 'GA4' | 'Google Ads' | 'Meta' | 'Bing UET' | 'Microsoft Clarity' | 'TikTok'
  method: string
  eventName: string | null
  ids: {
    measurementId?: string  // GA4 tid (G-…)
    conversionId?: string   // Google Ads tid (AW-…) or path-based
    pixelId?: string        // Meta / TikTok
    uetId?: string          // Bing UET ti param or path segment
  }
  params: Record<string, string>
  ts?: number               // webRequest timeStamp (ms since epoch)
  firedBeforeConsent?: boolean
  consentState?: Record<string, 'granted' | 'denied'>
  status?: number
  ok?: boolean
}

export interface RequestEntry {
  url: string
  method: string
  type?: string      // webRequest ResourceType (script, xmlhttprequest, …)
  ts?: number        // webRequest timeStamp (ms since epoch)
  status?: number    // HTTP response status code
  initiator?: { type: string; url?: string; stack?: string[] }
}

function detectPlatform(host: string, path: string, params: URLSearchParams): TrackingHit['platform'] | null {
  const tid = params.get('tid') ?? ''
  if (tid.startsWith('G-')) return 'GA4'
  if (tid.startsWith('AW-')) return 'Google Ads'

  if (params.get('v') === '2' && (path.endsWith('/g/collect') || path.endsWith('/mp/collect'))) return 'GA4'
  if (/(^|\.)google-analytics\.com$/.test(host) && path.includes('/collect')) return 'GA4'

  if (/(^|\.)googleadservices\.com$/.test(host) || /(^|\.)googlesyndication\.com$/.test(host)) return 'Google Ads'
  if (path.startsWith('/pagead/')) return 'Google Ads'

  if (/(^|\.)facebook\.com$/.test(host) && path.startsWith('/tr')) return 'Meta'

  if (/(^|\.)bat\.bing\.com$/.test(host)) return 'Bing UET'
  if (/(^|\.)clarity\.ms$/.test(host)) return 'Microsoft Clarity'

  if (/(^|\.)analytics\.tiktok\.com$/.test(host)) return 'TikTok'

  return null
}

function extractIds(
  platform: TrackingHit['platform'],
  params: URLSearchParams,
  pathname: string,
): TrackingHit['ids'] {
  const ids: TrackingHit['ids'] = {}
  const tid = params.get('tid') ?? ''

  if (platform === 'GA4') {
    if (tid.startsWith('G-')) ids.measurementId = tid
  } else if (platform === 'Google Ads') {
    if (tid.startsWith('AW-')) {
      ids.conversionId = tid
    } else {
      const m = pathname.match(/\/conversion\/([^/?]+)/)
      if (m) ids.conversionId = `AW-${m[1]}`
    }
  } else if (platform === 'Meta') {
    const id = params.get('id')
    if (id) ids.pixelId = id
  } else if (platform === 'TikTok') {
    const id = params.get('pixel_code') ?? params.get('id')
    if (id) ids.pixelId = id
  } else if (platform === 'Bing UET') {
    const ti = params.get('ti')
    if (ti) {
      ids.uetId = ti
    } else {
      // ti absent on script-load requests, e.g. bat.bing.com/p/action/<uetId>.js
      const m = pathname.match(/\/p\/action\/(\d+)/)
      if (m) ids.uetId = m[1]
    }
  }

  return ids
}

/** Parses the observed requests for recognizable tracking hits (GA4, Google Ads,
 *  Meta, Bing UET, Microsoft Clarity, TikTok). `firedBeforeConsent`/`consentState`
 *  are derived from the `gcs` query param and omitted when `gcs` is absent
 *  (e.g. Meta Pixel, Microsoft Clarity). */
export function parseTrackingHits(entries: RequestEntry[]): TrackingHit[] {
  const hits: TrackingHit[] = []
  for (const { url, method, status, ts } of entries) {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      continue
    }
    const platform = detectPlatform(parsed.hostname, parsed.pathname, parsed.searchParams)
    if (!platform) continue

    const params: Record<string, string> = {}
    for (const [k, v] of parsed.searchParams.entries()) params[k] = v

    const hit: TrackingHit = {
      url,
      platform,
      method,
      eventName: platform === 'GA4' ? (params.en ?? null) : platform === 'Meta' ? (params.ev ?? null) : null,
      ids: extractIds(platform, parsed.searchParams, parsed.pathname),
      params,
      ...(ts != null ? { ts } : {}),
      ...(status != null ? { status, ok: status >= 200 && status < 400 } : {}),
    }

    const gcs = parsed.searchParams.get('gcs')
    if (gcs) {
      const consentState = gcsToConsentState(gcs)
      if (consentState) {
        hit.consentState = consentState
        hit.firedBeforeConsent = Object.values(consentState).some((v) => v === 'denied')
      }
    }

    hits.push(hit)
  }
  return hits
}
