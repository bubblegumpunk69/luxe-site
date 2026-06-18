export default async (request) => {
  const url = new URL(request.url);
  const rest = url.pathname.replace(/^\/pluto-proxy/, '');

  // Patch required Pluto params
  const params = url.searchParams;
  if (!params.get('deviceId') || params.get('deviceId') === 'unknown') {
    params.set('deviceId', 'luxe-' + crypto.randomUUID());
  }
  if (!params.get('clientTime'))  params.set('clientTime',  new Date().toISOString());
  if (!params.get('appName'))     params.set('appName',     'web');
  if (!params.get('appVersion'))  params.set('appVersion',  '6.0.0');
  if (!params.get('deviceMake'))  params.set('deviceMake',  'Apple');
  if (!params.get('deviceModel')) params.set('deviceModel', 'MacIntel');
  if (!params.get('deviceType'))  params.set('deviceType',  'web');

  const targetUrl = 'https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv' + rest + '?' + params.toString();

  let resp;
  try {
    resp = await fetch(targetUrl, {
      headers: {
        'User-Agent':  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Origin':      'https://pluto.tv',
        'Referer':     'https://pluto.tv/',
        'Accept':      '*/*',
      }
    });
  } catch (e) {
    return new Response('Proxy fetch error: ' + e.message, { status: 502 });
  }

  if (!resp.ok) {
    const body = await resp.text();
    return new Response('Pluto error ' + resp.status + ': ' + body.slice(0, 200), { status: resp.status });
  }

  const ct = resp.headers.get('content-type') || '';
  const isManifest = ct.includes('mpegurl') || rest.includes('.m3u8');

  if (isManifest) {
    let text = await resp.text();
    // Rewrite absolute Pluto CDN URLs to route through our proxy
    text = text.replace(/https:\/\/[a-zA-Z0-9.-]*\.pluto\.tv/g, '/pluto-proxy');
    return new Response(text, {
      status: 200,
      headers: {
        'content-type':                ct || 'application/vnd.apple.mpegurl',
        'access-control-allow-origin': '*',
        'cache-control':               'no-cache',
      },
    });
  }

  // TS segments — stream through with CORS header
  const headers = new Headers();
  headers.set('access-control-allow-origin', '*');
  const respCt = resp.headers.get('content-type');
  if (respCt) headers.set('content-type', respCt);

  return new Response(resp.body, { status: resp.status, headers });
};

export const config = { path: '/pluto-proxy/*' };
