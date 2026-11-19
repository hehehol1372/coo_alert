/**
 * 쿠팡 장바구니 페이지 안에서 실행되는 추출 함수.
 * chrome.scripting.executeScript({ func })로 주입되므로 **외부 변수·import를 참조하면 안 된다** (자기완결).
 *
 * ⚠️ 쿠팡 DOM 구조를 실제 로그인 상태에서 확인한 뒤 셀렉터를 다듬어야 한다.
 *    지금은 구조에 의존하지 않는 휴리스틱(가격 패턴이 든 가장 안쪽 행)을 쓴다.
 *    추출 실패 시 LLM 추출 대체(2단계)로 넘어간다.
 * 주소·이름 등 개인정보 영역은 읽지 않는다.
 */
export function extractCart() {
  const PRICE = /([\d,]{3,})\s*원/
  const SOLD_OUT = /품절|일시\s*품절|재고\s*없음/
  const ARRIVAL = /(오늘|내일|새벽|당일|저녁|도착)[^\n]{0,30}(도착|배송)[^\n]{0,20}/

  if (/login\.coupang\.com/.test(location.href)) {
    return { loginRequired: true, items: [], arrivalText: null as string | null }
  }

  const rows = Array.from(document.querySelectorAll<HTMLElement>('li, tr, [class*="cart"][class*="item" i], [class*="product" i]'))
    .filter((el) => PRICE.test(el.innerText) && el.innerText.length < 400)
    // 가장 안쪽 행만 사용 (자식 중에 같은 조건을 만족하는 요소가 있으면 제외)
    .filter((el) => !Array.from(el.children).some((c) => c instanceof HTMLElement && PRICE.test(c.innerText) && c.matches('li, tr, [class*="item" i], [class*="product" i]')))

  const seen = new Set<string>()
  const items: { name: string; price: number | null; soldOut: boolean }[] = []

  for (const row of rows) {
    const lines = row.innerText.split('\n').map((s) => s.trim()).filter(Boolean)
    const name = lines.find((l) => l.length >= 4 && !PRICE.test(l) && !SOLD_OUT.test(l) && !/^[\d,\s개]+$/.test(l))
    if (!name || seen.has(name)) continue
    seen.add(name)
    const m = row.innerText.match(PRICE)
    items.push({
      name: name.slice(0, 80),
      price: m ? Number(m[1].replace(/,/g, '')) : null,
      soldOut: SOLD_OUT.test(row.innerText),
    })
  }

  const arrival = document.body.innerText.match(ARRIVAL)
  return { loginRequired: false, items, arrivalText: arrival ? arrival[0].trim() : null }
}
