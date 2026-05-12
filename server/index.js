import http from 'node:http';

const PORT = 4000;

const USERS = [
  {
    email: 'demo@example.com',
    password: 'password123',
    name: 'Demo User',
  },
];

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

function handleLogin(req, res) {
  readRequestBody(req)
    .then((body) => {
      const { email, password } = body;
      const user = USERS.find((candidate) => candidate.email === email && candidate.password === password);

      if (!user) {
        sendJson(res, 401, { error: 'Invalid credentials' });
        return;
      }

      sendJson(res, 200, {
        user: {
          email: user.email,
          name: user.name,
        },
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

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});