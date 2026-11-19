import { DEFAULT_SETTINGS, HISTORY_LIMIT } from './config'
import type { Diff, RunLog, Settings, Snapshot } from './types'

/** chrome.storage.local 단일 키 조회 (타입 지정) */
export async function getKey<T>(key: string): Promise<T | undefined> {
  const res = (await chrome.storage.local.get(key)) as Record<string, unknown>
  return res[key] as T | undefined
}

export async function getSettings(): Promise<Settings> {
  const settings = await getKey<Settings>('settings')
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings })
}

export async function getHistory(): Promise<Snapshot[]> {
  return (await getKey<Snapshot[]>('history')) ?? []
}

export async function pushSnapshot(snapshot: Snapshot): Promise<Snapshot | null> {
  const history = await getHistory()
  const previous = history.at(-1) ?? null
  history.push(snapshot)
  await chrome.storage.local.set({ history: history.slice(-HISTORY_LIMIT) })
  return previous
}

export async function addLog(log: RunLog): Promise<void> {
  const logs = (await getKey<RunLog[]>('logs')) ?? []
  const next: RunLog[] = [...logs, log].slice(-50)
  await chrome.storage.local.set({ logs: next })
}

export async function getLogs(): Promise<RunLog[]> {
  return (await getKey<RunLog[]>('logs')) ?? []
}

/** 서버 남용 방지 + 사용자 구분용 설치 ID (개인정보 아님) */
export async function getInstallId(): Promise<string> {
  const installId = await getKey<string>('installId')
  if (installId) return installId
  const id = crypto.randomUUID()
  await chrome.storage.local.set({ installId: id })
  return id
}

/** 오늘 실행 횟수를 올리고, 상한을 넘으면 false */
export async function consumeDailyQuota(max: number): Promise<boolean> {
  const today = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD
  const quota = await getKey<{ date: string; count: number }>('quota')
  const count = quota?.date === today ? quota.count : 0
  if (count >= max) return false
  await chrome.storage.local.set({ quota: { date: today, count: count + 1 } })
  return true
}

export function computeDiff(prev: Snapshot | null, curr: Snapshot): Diff {
  const diff: Diff = { priceChanges: [], newlySoldOut: [], backInStock: [], added: [], removed: [] }
  if (!prev) return diff

  const before = new Map(prev.items.map((i) => [i.name, i]))
  const after = new Map(curr.items.map((i) => [i.name, i]))

  for (const [name, item] of after) {
    const old = before.get(name)
    if (!old) {
      diff.added.push(name)
      continue
    }
    if (old.price != null && item.price != null && old.price !== item.price) {
      diff.priceChanges.push({ name, from: old.price, to: item.price })
    }
    if (!old.soldOut && item.soldOut) diff.newlySoldOut.push(name)
    if (old.soldOut && !item.soldOut) diff.backInStock.push(name)
  }
  for (const name of before.keys()) if (!after.has(name)) diff.removed.push(name)
  return diff
}
