import { defineManifest } from '@crxjs/vite-plugin'

// 확장 ID 고정용 공개키 → ID: madifnngddghnhphnldbpaobbmibfkgf
// 카카오 Redirect URI: https://madifnngddghnhphnldbpaobbmibfkgf.chromiumapp.org/
// (개인키는 .keys/에 있으며 커밋하지 않는다. 공개키는 공개되어도 무방)
const KEY = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp7X5EbXwei1JHIQaQpEu85eGk70xoIsMZZo/55p6LLtWKHoMSHrv0H1h5qE0tyDO3GN9FpJTDFWzPCjxL/DxWfNLBUzOQolfxmNNkEoxhJTge9IOQt1abrf3pLUj9exg3qI4hbo/5N086eBMTO6P/4Ify+4kesm3fBy7cZ/ekzsNIWXGlbRhWBeLSePtz98c08RU/dA6At/oCgkPm4cPwJe4zRzIjYz5ktIYt49+26vz/fzZgz59UEm3pOrZTroNoCOn9FhegxS5hss+gnLW1LuirP+CurxltRx3AkYotGqflDFWuM++XFB6O4N/3ZGAH9iRfzY9tL5cERvuVGy5oQIDAQAB'

export default defineManifest({
  manifest_version: 3,
  key: KEY,
  name: 'CooAlert - 쿠팡프레시 장바구니 알리미',
  description: '정해진 시각에 쿠팡 장바구니를 확인하고 AI 브리핑을 카카오톡으로 보내 줍니다.',
  version: '0.1.0',
  permissions: ['alarms', 'tabs', 'scripting', 'storage', 'identity', 'notifications', 'background'],
  host_permissions: ['https://*.coupang.com/*', 'https://*.vercel.app/*'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_title: 'CooAlert',
    default_popup: 'src/popup/index.html',
  },
})
