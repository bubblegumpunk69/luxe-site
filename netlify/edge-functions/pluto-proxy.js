export default async (request) => {
  const url = new URL(request.url);
  const rest = url.pathname.replace(/^\/pluto-proxy/, '');
  const targetUrl = 'https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv' + rest + url.search;

  let resp;
  try {
    resp = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': 'https://pluto.tv',
        'Referer': 'https://pluto.tv/',
      }
    });
  } catch (e) {
    return new Response('Proxy error: ' + e.message, { status: 502 });
  }

  const ct = resp.headers.get('content-type') || '';
  const isManifest = ct.includes('mpegurl') || rest.includes('.m3u8');

  if (isManifest) {
    let text = await resp.text();
    // Rewrite any absolute Pluto CDN URLs to go through our proxy
    text = text.replace(/https:\/\/[a-zA-Z0-9.-]*\.pluto\.tv/g, '/pluto-proxy');
    return new Response(text, {
      status: resp.status,
      headers: {
        'content-type': ct || 'application/vnd.apple.mpegurl',
        'access-control-allow-origin': '*',
        'cache-control': 'no-cache',
      },
    });
  }

  // TS segments and other assets — stream through with CORS header added
  const headers = new Headers();
  headers.set('access-control-allow-origin', '*');
  const respCt = resp.headers.get('content-type');
  if (respCt) headers.set('content-type', respCt);

  return new Response(resp.body, { status: resp.status, headers });
};

export const config = { path: '/pluto-proxy/*' };
