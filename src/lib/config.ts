// 서버 주소. Vercel 배포 후 실제 도메인으로 교체한다. (비밀값 아님 — API 키는 서버 환경변수에만 둔다)
export const SERVER_URL = 'https://coo-alert.vercel.app'

export const CART_URL = 'https://cart.coupang.com/cartView.pang'

export const ALARM_NAME = 'coo-alert-daily'

export const DEFAULT_SETTINGS = { hour: 10, minute: 30 }

/** 쿠팡 조회는 하루 몇 회 수준으로 제한 */
export const MAX_RUNS_PER_DAY = 5

export const HISTORY_LIMIT = 90 // 보관할 스냅샷 수
