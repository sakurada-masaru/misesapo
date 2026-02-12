const YOTEI_GATEWAY = 'https://v7komjxk4k.execute-api.ap-northeast-1.amazonaws.com/prod';
const YOTEI_GATEWAY_HOST = 'v7komjxk4k.execute-api.ap-northeast-1.amazonaws.com';
const YOTEI_GATEWAY_HOST_SUFFIX = '.execute-api.ap-northeast-1.amazonaws.com';

export function normalizeGatewayBase(rawBase, fallbackBase) {
  let base = String(rawBase || fallbackBase || '').trim();
  if (!base) return '';

  // Guard: historical API id typo should never break runtime.
  try {
    const url = new URL(base);
    const hostname = String(url.hostname || '');
    if (
      hostname.startsWith('v7komj') &&
      hostname.endsWith(YOTEI_GATEWAY_HOST_SUFFIX) &&
      hostname !== YOTEI_GATEWAY_HOST
    ) {
      url.hostname = YOTEI_GATEWAY_HOST;
      base = url.toString();
    }
  } catch {
    // ignore invalid URL and use raw string fallback
  }

  return base.replace(/\/+$/, '');
}

export { YOTEI_GATEWAY };
