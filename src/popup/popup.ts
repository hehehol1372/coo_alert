import { connectKakao, disconnectKakao, isKakaoConnected } from '../lib/api'
import { getHistory, getLogs, getSettings, saveSettings } from '../lib/storage'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const pad = (n: number) => String(n).padStart(2, '0')

async function renderLogs() {
  const logs = (await getLogs()).slice(-5).reverse()
  $('logs').replaceChildren(
    ...logs.map((l) => {
      const li = document.createElement('li')
      li.textContent = `${new Date(l.at).toLocaleString('ko-KR')} ${l.ok ? '✅' : '⚠️'} ${l.message}`
      return li
    }),
  )
}

/** 마지막으로 읽은 장바구니 상품 목록 (추출이 맞는지 눈으로 확인용) */
async function renderItems() {
  const last = (await getHistory()).at(-1)
  if (!last) {
    $('items').textContent = '아직 확인 기록이 없어요.'
    return
  }
  const title = document.createElement('div')
  title.textContent = `읽은 상품 ${last.items.length}개 (${new Date(last.takenAt).toLocaleString('ko-KR')})`
  const ol = document.createElement('ol')
  for (const i of last.items) {
    const li = document.createElement('li')
    li.textContent = `${i.name}${i.option ? ` (${i.option})` : ''}${i.quantity && i.quantity > 1 ? ` ×${i.quantity}` : ''} — ${i.price == null ? '가격 없음' : `${i.price.toLocaleString('ko-KR')}원`}${i.soldOut ? ' (품절)' : ''}`
    ol.append(li)
  }
  $('items').replaceChildren(title, ol)
}

async function renderKakao() {
  $('kakao').textContent = (await isKakaoConnected()) ? '카카오톡 연결 해제' : '카카오톡 연결'
}

async function init() {
  const s = await getSettings()
  $<HTMLInputElement>('time').value = `${pad(s.hour)}:${pad(s.minute)}`
  await renderLogs()
  await renderKakao()
  await renderItems()

  $('kakao').addEventListener('click', async () => {
    try {
      if (await isKakaoConnected()) {
        await disconnectKakao()
        $('result').textContent = '카카오톡 연결을 해제했어요.'
      } else {
        $('result').textContent = '카카오 로그인 창을 여는 중…'
        await connectKakao()
        $('result').textContent = '카카오톡이 연결됐어요. 이제 알림이 카톡으로 와요.'
      }
    } catch (e) {
      $('result').textContent = `카카오 연결 실패: ${e instanceof Error ? e.message : e}`
    }
    await renderKakao()
  })

  $('save').addEventListener('click', async () => {
    const [hour, minute] = $<HTMLInputElement>('time').value.split(':').map(Number)
    await saveSettings({ hour, minute })
    await chrome.runtime.sendMessage({ type: 'reschedule' })
    $('result').textContent = `매일 ${pad(hour)}:${pad(minute)}에 알려드릴게요.`
  })

  $('run').addEventListener('click', async () => {
    const btn = $<HTMLButtonElement>('run')
    btn.disabled = true
    $('result').textContent = '장바구니 확인 중… (최대 30초)'
    const res = await chrome.runtime.sendMessage({ type: 'run-now' })
    $('result').textContent = res?.text ?? '결과를 받지 못했어요.'
    btn.disabled = false
    await renderLogs()
    await renderItems()
  })
}

void init()
