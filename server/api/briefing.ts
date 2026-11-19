// POST /api/briefing  { items, arrivalText, diff } → { text }
// 변동 계산은 확장이 코드로 끝낸 상태이고, LLM은 그 결과를 짧은 카톡 문장으로 정리만 한다.
// 입력에는 상품명/가격/품절/도착 문구만 있다 (주소·이름 등 개인정보 없음).
import Anthropic from '@anthropic-ai/sdk'
import { checkInstallId, error, json, readJson, requireEnv, unexpected } from '../lib/http.js'

const MODEL = 'claude-haiku-5-5'
let client: Anthropic | null = null

/** 요청 시점에 생성: 키가 없으면 모듈 로딩이 아니라 요청에서 원인을 알려준다 */
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') })
  return client
}

interface Item {
  name: string
  price: number | null
  soldOut: boolean
}
interface Body {
  items: Item[]
  arrivalText: string | null
  diff: {
    priceChanges: { name: string; from: number; to: number }[]
    newlySoldOut: string[]
    backInStock: string[]
    added: string[]
    removed: string[]
  }
}

const SYSTEM = `당신은 쿠팡프레시 장바구니를 확인해 주는 비서입니다.
주어진 장바구니 정보와 변동 내역을 카카오톡 메시지로 보낼 짧은 한국어 브리핑으로 정리하세요.

규칙:
- 180자 이내, 2~4줄, 친근한 존댓말. 이모지는 줄 앞에 최대 1개씩.
- 첫 줄: 주문 마감(낮 12시)까지 남은 시간과 도착 예정 정보.
- 이어서 중요한 순서로: 품절 → 가격 인상 → 가격 인하 → 재입고. 금액은 "+200원"처럼 차이를 쓴다.
- 변동이 없으면 "변동 없음"이라고 짧게 말한다.
- 주어진 데이터에 없는 내용은 지어내지 않는다. 구매를 강요하지 않는다.
- 브리핑 본문만 출력한다.`

function nowKst() {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  return { hour: get('hour'), minute: get('minute') }
}

function isValid(b: Body | null): b is Body {
  return !!b && Array.isArray(b.items) && b.items.length <= 100 && typeof b.diff === 'object' && b.diff !== null
}

export async function POST(req: Request): Promise<Response> {
  if (!checkInstallId(req)) return error(401, 'missing install id')
  const body = await readJson<Body>(req)
  if (!isValid(body)) return error(400, 'invalid body')

  const { hour, minute } = nowKst()
  const minutesLeft = 12 * 60 - (hour * 60 + minute)
  const input = {
    현재시각: `${hour}:${String(minute).padStart(2, '0')}`,
    주문마감까지: minutesLeft > 0 ? `${Math.floor(minutesLeft / 60)}시간 ${minutesLeft % 60}분` : '오늘 마감 지남',
    도착예정문구: body.arrivalText,
    장바구니: body.items.map((i) => ({ 상품: i.name.slice(0, 80), 가격: i.price, 품절: i.soldOut })),
    변동: body.diff,
  }

  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    })
    if (res.stop_reason === 'refusal') return error(502, 'refused')
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
    if (!text) return error(502, 'empty response')
    return json({ text: text.slice(0, 200) })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return error(429, 'rate limited')
    if (e instanceof Anthropic.APIError) {
      console.error('anthropic', e.status, e.message)
      return error(502, `llm error ${e.status ?? ''}`.trim())
    }
    return unexpected(e)
  }
}
