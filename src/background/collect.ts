import { CART_URL } from '../lib/config'
import type { CollectResult } from '../lib/types'
import { extractCart } from './extract'

const LOAD_TIMEOUT_MS = 30_000
const RENDER_WAIT_MS = 2_500 // SPA 렌더링 대기

function waitForLoad(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => done(false), LOAD_TIMEOUT_MS)
    const listener = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && info.status === 'complete') done(true)
    }
    function done(ok: boolean) {
      clearTimeout(timer)
      chrome.tabs.onUpdated.removeListener(listener)
      resolve(ok)
    }
    chrome.tabs.onUpdated.addListener(listener)
  })
}

/** 장바구니를 백그라운드 탭으로 열어 추출하고 탭을 닫는다. 구매 동작은 하지 않는다. */
export async function collectCart(): Promise<CollectResult> {
  const tab = await chrome.tabs.create({ url: CART_URL, active: false })
  const tabId = tab.id!
  try {
    if (!(await waitForLoad(tabId))) return { ok: false, reason: 'timeout' }
    await new Promise((r) => setTimeout(r, RENDER_WAIT_MS))

    const current = await chrome.tabs.get(tabId)
    if (current.url?.includes('login.coupang.com')) return { ok: false, reason: 'login_required' }

    const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: extractCart })
    const data = res?.result
    if (!data) return { ok: false, reason: 'error', detail: 'no result' }
    if (data.loginRequired) return { ok: false, reason: 'login_required' }
    if (data.items.length === 0) return { ok: false, reason: 'empty' }

    return { ok: true, snapshot: { takenAt: Date.now(), items: data.items, arrivalText: data.arrivalText } }
  } catch (e) {
    return { ok: false, reason: 'error', detail: String(e) }
  } finally {
    chrome.tabs.remove(tabId).catch(() => {})
  }
}
