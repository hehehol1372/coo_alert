import { sendKakao } from '../lib/api'
import { ALARM_NAME, MAX_RUNS_PER_DAY } from '../lib/config'
import { addLog, computeDiff, consumeDailyQuota, getKey, getSettings, pushSnapshot } from '../lib/storage'
import { formatMessage } from '../lib/message'
import { collectCart } from './collect'
import { EXTRACTOR_VERSION } from './extract'

const REASON_TEXT = {
  login_required: '쿠팡 로그인이 만료됐어요. 다시 로그인해 주세요.',
  empty: '장바구니에서 상품을 찾지 못했어요. 장바구니가 비었거나 화면 구조가 바뀌었을 수 있어요.',
  timeout: '쿠팡 페이지 로딩이 너무 오래 걸려요.',
  error: '장바구니를 확인하는 중 오류가 났어요.',
} as const

function notify(title: string, message: string) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    title,
    message,
  })
}

/** 카카오톡으로 보내고, 실패하면 크롬 알림으로 대체한다. */
async function deliver(title: string, text: string) {
  try {
    await sendKakao(text)
  } catch (e) {
    notify(title, text)
    if (e instanceof Error && e.message === 'kakao_reauth_required') {
      notify('CooAlert', '카카오 연결이 만료됐어요. 팝업에서 카카오톡을 다시 연결해 주세요.')
    }
  }
}

export async function runCheck(manual = false): Promise<string> {
  if (!manual && !(await consumeDailyQuota(MAX_RUNS_PER_DAY))) return '오늘 조회 한도를 넘었어요.'

  const result = await collectCart()
  if (!result.ok) {
    const msg = REASON_TEXT[result.reason]
    await addLog({ at: Date.now(), ok: false, message: msg })
    await deliver('CooAlert', msg)
    return msg
  }

  // 추출 방식이 바뀌었으면 예전 기록과 비교하지 않는다 (엉뚱한 변동 알림 방지)
  if ((await getKey<number>('extractorVersion')) !== EXTRACTOR_VERSION) {
    await chrome.storage.local.set({ history: [], extractorVersion: EXTRACTOR_VERSION })
  }
  const previous = await pushSnapshot(result.snapshot)
  const diff = computeDiff(previous, result.snapshot)

  const text = formatMessage(result.snapshot, diff)
  await deliver('CooAlert 장바구니 알림', text)
  await addLog({ at: Date.now(), ok: true, message: text })
  return text
}

/** 설정 시각 기준으로 다음 알람을 등록한다 (매일 반복). */
export async function scheduleAlarm() {
  const { hour, minute } = await getSettings()
  const when = new Date()
  when.setHours(hour, minute, 0, 0)
  if (when.getTime() <= Date.now()) when.setDate(when.getDate() + 1)
  await chrome.alarms.create(ALARM_NAME, { when: when.getTime(), periodInMinutes: 24 * 60 })
}

/** 크롬이 꺼져 있어 놓친 오늘 알람을, 정오 전이면 시작 시점에 보충 실행한다. */
async function catchUpMissed() {
  const { hour, minute } = await getSettings()
  const now = new Date()
  const scheduled = new Date()
  scheduled.setHours(hour, minute, 0, 0)
  const today = now.toLocaleDateString('sv-SE')
  const lastRunDate = await getKey<string>('lastRunDate')
  if (lastRunDate !== today && now > scheduled && now.getHours() < 12) {
    await chrome.storage.local.set({ lastRunDate: today })
    await runCheck()
  }
}

chrome.runtime.onInstalled.addListener(() => void scheduleAlarm())
chrome.runtime.onStartup.addListener(() => {
  void scheduleAlarm()
  void catchUpMissed()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return
  await chrome.storage.local.set({ lastRunDate: new Date().toLocaleDateString('sv-SE') })
  await runCheck()
})

// 팝업에서 오는 메시지
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'run-now') {
    runCheck(true).then((text) => sendResponse({ text }))
    return true // 비동기 응답
  }
  if (msg?.type === 'reschedule') {
    scheduleAlarm().then(() => sendResponse({ ok: true }))
    return true
  }
})
