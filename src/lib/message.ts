import type { Diff, Snapshot } from './types'

const MAX_LEN = 200 // 카카오 기본 텍스트 템플릿 최대 길이
const won = (n: number) => n.toLocaleString('ko-KR')

/** 정오 주문 마감까지 남은 시간 문구 */
function deadlineText(now: Date): string {
  const left = 12 * 60 - (now.getHours() * 60 + now.getMinutes())
  if (left <= 0) return '오늘 주문 마감(12시) 지남'
  const h = Math.floor(left / 60)
  const m = left % 60
  return `주문 마감까지 ${h ? `${h}시간 ` : ''}${m}분`
}

/**
 * 변동 내역을 그대로 알림 문장으로 만든다 (LLM 없이 규칙 기반).
 * 예)
 * 🛒 장바구니 확인 10:30
 * ⏰ 주문 마감까지 1시간 30분 · 오늘 저녁 도착 예정
 * 📈 서울우유 1L 2,900→3,100원 (+200)
 * ❌ 무항생제 계란 30구 품절
 */
export function formatMessage(snapshot: Snapshot, diff: Diff, now = new Date()): string {
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
  const header = [`🛒 장바구니 확인 ${time}`, `⏰ ${[deadlineText(now), snapshot.arrivalText].filter(Boolean).join(' · ')}`]

  // 중요한 순서: 품절 → 가격 인상 → 가격 인하 → 재입고
  const changes: string[] = [
    ...diff.newlySoldOut.map((n) => `❌ ${n} 품절`),
    ...diff.priceChanges
      .filter((c) => c.to > c.from)
      .map((c) => `📈 ${c.name} ${won(c.from)}→${won(c.to)}원 (+${won(c.to - c.from)})`),
    ...diff.priceChanges
      .filter((c) => c.to < c.from)
      .map((c) => `📉 ${c.name} ${won(c.from)}→${won(c.to)}원 (${won(c.to - c.from)})`),
    ...diff.backInStock.map((n) => `✅ ${n} 재입고`),
  ]

  if (changes.length === 0) {
    const soldOut = snapshot.items.filter((i) => i.soldOut).length
    changes.push(`변동 없음 (상품 ${snapshot.items.length}개${soldOut ? `, 품절 ${soldOut}개` : ''})`)
  }

  // 200자를 넘으면 뒤쪽 항목을 "외 N건"으로 줄인다
  const lines = [...header]
  for (let i = 0; i < changes.length; i++) {
    const rest = changes.length - i - 1
    const candidate = [...lines, changes[i]].join('\n')
    const suffix = rest > 0 ? `\n외 ${rest}건` : ''
    if ((candidate + suffix).length > MAX_LEN) {
      lines.push(`외 ${changes.length - i}건`)
      break
    }
    lines.push(changes[i])
  }
  return lines.join('\n').slice(0, MAX_LEN)
}
