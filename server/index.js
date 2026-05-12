import http from 'node:http';
import crypto from 'node:crypto';

const PORT = 4000;

const USERS = [
  {
    email: 'demo@example.com',
    password: 'password123',
    name: 'Demo User',
  },
];

const sessions = new Map();

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      const rawBody = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });

    req.on('error', reject);
  });
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((cookies, pair) => {
    const [rawKey, ...rawValue] = pair.trim().split('=');
    if (!rawKey) {
      return cookies;
    }

    cookies[rawKey] = decodeURIComponent(rawValue.join('=') || '');
    return cookies;
  }, {});
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.sessionId;

  if (!sessionId) {
    return null;
  }

  return sessions.get(sessionId) || null;
}

function handleLogin(req, res) {
  readRequestBody(req)
    .then((body) => {
      const { email, password } = body;
      const user = USERS.find((candidate) => candidate.email === email && candidate.password === password);

      if (!user) {
        sendJson(res, 401, { error: 'Invalid credentials' });
        return;
      }

      const sessionId = crypto.randomUUID();
      const csrfToken = crypto.randomUUID();

      sessions.set(sessionId, {
        email: user.email,
        name: user.name,
        csrfToken,
      });

      sendJson(res, 200, {
        isAuthenticated: true,
        token: crypto.randomUUID(),
        user: {
          email: user.email,
          name: user.name,
        },
        csrfToken,
        sessionId,
      }, {
        'Set-Cookie': `sessionId=${encodeURIComponent(sessionId)}; HttpOnly; Path=/; SameSite=Lax`,
      });
    })
    .catch((error) => {
      sendJson(res, 400, { error: error.message });
    });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/login' && req.method === 'POST') {
    handleLogin(req, res);
    return;
  }

  if (url.pathname === '/api/csrf-token' && req.method === 'GET') {
    const session = getSession(req);

    if (!session) {
      sendJson(res, 401, { error: 'Not authenticated' });
      return;
    }

    sendJson(res, 200, { csrfToken: session.csrfToken });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});