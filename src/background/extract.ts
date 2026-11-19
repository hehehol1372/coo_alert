/** 추출 로직이 바뀌면 올린다. 값이 바뀌면 이전 기록(비교 기준)을 비운다. */
export const EXTRACTOR_VERSION = 3 // 3: 품절임박을 품절로 잘못 판정하던 문제 수정

/**
 * 쿠팡 장바구니 페이지 안에서 실행되는 추출 함수.
 * chrome.scripting.executeScript({ func })로 주입되므로 **외부 변수·import를 참조하면 안 된다** (자기완결).
 *
 * 쿠팡 장바구니 구조 (2026-11 확인):
 *   상품 한 개   div[id^="item_"][data-bundle-id]   ← 추천 상품 영역에는 없음
 *   상품명/옵션  #name a > span (첫 번째: 이름, 두 번째: "옵션: 30g, 1개")
 *   가격 영역    [data-component-id="price-area"]   (취소선 = 정가, p = 단위가격)
 *   도착 예정    "내일(금) 새벽 도착" 같은 초록색 문구
 *   수량         input.cart-quantity-input
 * 주소·이름 등 개인정보 영역은 읽지 않는다.
 */
export function extractCart() {
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const toNumber = (s: string) => {
    const n = Number(s.replace(/[^\d]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }

  if (/login\.coupang\.com/.test(location.href)) {
    return { loginRequired: true, items: [], arrivalText: null as string | null }
  }

  /** 가격 영역에서 최종 결제가 추출 (정가·단위가격·쿠폰 문구 제외) */
  function readPrice(area: Element | null): number | null {
    if (!area) return null
    // 1순위: 굵은 숫자만 있는 span (예: <span class="... twc-font-bold">4,490</span>)
    for (const el of area.querySelectorAll('span, strong, b')) {
      const t = text(el)
      if (/^[\d,]+$/.test(t) && /font-bold/.test(el.getAttribute('class') ?? '') && !el.closest('[class*="line-through"]')) {
        return toNumber(t)
      }
    }
    // 2순위: 정가(취소선)·단위가격(p)·쿠폰 문구를 지우고 처음 나오는 "N원"
    const clone = area.cloneNode(true) as Element
    clone.querySelectorAll('[class*="line-through"], p, img').forEach((e) => e.remove())
    const m = text(clone)
      .replace(/[\d,]+원\s*쿠폰[^\d]*/g, '')
      .match(/([\d,]+)\s*원/)
    return m ? toNumber(m[1]) : null
  }

  const rows = Array.from(document.querySelectorAll('div[id^="item_"][data-bundle-id]'))
  const seen = new Set<string>()
  const items: { name: string; option: string | null; price: number | null; quantity: number; soldOut: boolean }[] = []
  let arrivalText: string | null = null

  for (const row of rows) {
    // 모바일/PC 레이아웃이 둘 다 들어 있어 #name이 2번 나온다 → 첫 번째만
    const spans = row.querySelectorAll('#name a span')
    const name = text(spans[0])
    if (!name || seen.has(name)) continue
    seen.add(name)

    const option = text(spans[1]).replace(/^옵션\s*:\s*/, '') || null
    const qtyInput = row.querySelector<HTMLInputElement>('input.cart-quantity-input')
    const quantity = Number(qtyInput?.value) || 1
    const all = text(row)
    // "품절임박 ∙ 2개 남음"은 품절이 아니다 → 먼저 지우고 판정
    const soldOut = /품절|재고\s*없음|구매\s*불가/.test(all.replace(/품절\s*임박/g, ''))

    // 도착 예정: 신선(FRESH) 상품의 문구를 우선 사용
    const arrival = all.match(/(오늘|내일|모레|\d+\/\d+)\s*\([^)]*\)?\s*(새벽|오전|오후|저녁|밤)?\s*도착(\s*(예정|보장))?/)
    if (arrival && (!arrivalText || row.getAttribute('data-type') === 'FRESH')) arrivalText = arrival[0].trim()

    items.push({
      name: name.slice(0, 80),
      option: option?.slice(0, 40) ?? null,
      price: readPrice(row.querySelector('[data-component-id="price-area"]')),
      quantity,
      soldOut,
    })
  }

  return { loginRequired: false, items, arrivalText }
}
