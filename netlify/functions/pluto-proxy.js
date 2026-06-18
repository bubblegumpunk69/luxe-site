const { randomUUID } = require('crypto');

exports.handler = async (event) => {
  const rest = event.path
    .replace(/^\/.netlify\/functions\/pluto-proxy/, '')
    .replace(/^\/pluto-proxy/, '');

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(event.queryStringParameters || {})) {
    params.set(k, v);
  }

  if (!params.get('deviceId') || params.get('deviceId') === 'unknown') {
    params.set('deviceId', 'luxe-' + randomUUID());
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
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Origin':     'https://pluto.tv',
        'Referer':    'https://pluto.tv/',
        'Accept':     '*/*',
      },
    });
  } catch (e) {
    return { statusCode: 502, body: 'Proxy fetch error: ' + e.message };
  }

  if (!resp.ok) {
    const body = await resp.text();
    return { statusCode: resp.status, body: 'Pluto error ' + resp.status + ': ' + body.slice(0, 300) };
  }

  const ct = resp.headers.get('content-type') || '';
  const isManifest = ct.includes('mpegurl') || rest.endsWith('.m3u8');

  if (isManifest) {
    let text = await resp.text();
    text = text.replace(/https:\/\/[a-zA-Z0-9.-]*\.pluto\.tv/g, '/pluto-proxy');
    return {
      statusCode: 200,
      headers: {
        'content-type':                ct || 'application/vnd.apple.mpegurl',
        'access-control-allow-origin': '*',
        'cache-control':               'no-cache',
      },
      body: text,
    };
  }

  // Binary TS segments / encryption keys
  const buffer = await resp.arrayBuffer();
  return {
    statusCode: resp.status,
    headers: {
      'access-control-allow-origin': '*',
      'content-type':                resp.headers.get('content-type') || 'video/MP2T',
    },
    body: Buffer.from(buffer).toString('base64'),
    isBase64Encoded: true,
  };
};
