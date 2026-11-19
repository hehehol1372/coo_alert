export interface CartItem {
  name: string
  option?: string | null // 예: "30g, 1개"
  price: number | null // 쿠폰 등 적용된 최종가 (1개 기준)
  quantity?: number
  soldOut: boolean
}

/** 장바구니 한 번 조회한 결과 */
export interface Snapshot {
  takenAt: number // epoch ms
  items: CartItem[]
  arrivalText: string | null // 예: "오늘 저녁 도착 예정"
}

export type CollectResult =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; reason: 'login_required' | 'empty' | 'timeout' | 'error'; detail?: string }

export interface PriceChange {
  name: string
  from: number
  to: number
}

/** 이전 스냅샷과의 차이 (코드로 계산하고, LLM에는 이 결과만 보낸다) */
export interface Diff {
  priceChanges: PriceChange[]
  newlySoldOut: string[]
  backInStock: string[]
  added: string[]
  removed: string[]
}

export interface Settings {
  hour: number
  minute: number
}

export interface RunLog {
  at: number
  ok: boolean
  message: string
}
