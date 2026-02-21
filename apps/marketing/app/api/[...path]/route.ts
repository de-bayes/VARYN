const API = process.env.API_URL || 'https://api-production-5af3.up.railway.app';

async function proxy(req: Request, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const url = `${API}/${path}`;

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);

  const res = await fetch(url, {
    method: req.method,
    headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.arrayBuffer() : undefined,
  });

  const responseHeaders = new Headers();
  const resCt = res.headers.get('content-type');
  if (resCt) responseHeaders.set('content-type', resCt);

  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;

export const dynamic = 'force-dynamic';
