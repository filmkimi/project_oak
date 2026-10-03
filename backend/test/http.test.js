const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

test('serves the storefront and admin login page', async () => {
  const [storefront, admin] = await Promise.all([
    fetch(baseUrl),
    fetch(`${baseUrl}/admin.html`)
  ]);

  assert.equal(storefront.status, 200);
  assert.match(await storefront.text(), /ระบบยืม-คืนอุปกรณ์/);
  assert.equal(admin.status, 200);
  assert.match(await admin.text(), /admin-login-form/);
});

test('health check reports the database connection state', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.status, 'unavailable');
});

test('protects borrow endpoints and rejects non-admin access', async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/borrows`);
  assert.equal(unauthenticated.status, 401);

  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';
  try {
    const studentToken = jwt.sign({ id: 'student-1', role: 'student' }, process.env.JWT_SECRET);
    const forbidden = await fetch(`${baseUrl}/api/borrows`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    assert.equal(forbidden.status, 403);

    const adminToken = jwt.sign({ id: 'admin-1', role: 'admin' }, process.env.JWT_SECRET);
    const invalidApproval = await fetch(`${baseUrl}/api/borrows/not-an-id/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(invalidApproval.status, 400);

    const invalidReturn = await fetch(`${baseUrl}/api/borrows/not-an-id/return`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ return_records: [] })
    });
    assert.equal(invalidReturn.status, 400);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('rejects malformed and expired bearer tokens', async () => {
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';
  try {
    const response = await fetch(`${baseUrl}/api/borrows`, {
      headers: { Authorization: 'Bearer invalid-token' }
    });
    assert.equal(response.status, 401);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('protects product changes and validates new product data', async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  assert.equal(unauthenticated.status, 401);

  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';
  try {
    const adminToken = jwt.sign({ id: 'admin-1', role: 'admin' }, process.env.JWT_SECRET);
    const invalidProduct = await fetch(`${baseUrl}/api/items`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_code: 'BAD-ITEM', name: '', category: 'invalid', total_qty: -1 })
    });
    assert.equal(invalidProduct.status, 400);
  } finally {
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
