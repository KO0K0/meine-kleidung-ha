const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomBytes, randomUUID } = require('node:crypto');
const base = process.env.SMOKE_URL || 'http://127.0.0.1:3088';
const [mode, stateFile] = process.argv.slice(2);
async function ready() {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(base + '/auth/login', { signal: AbortSignal.timeout(2000) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw Error('App did not become ready');
}
(async () => {
  await ready();
  for (const asset of ['/ocr/runtime/tesseract.esm.min.js', '/ocr/runtime/worker.min.js', '/ocr/core/tesseract-core-simd-lstm.wasm', '/ocr/lang/eng.traineddata.gz', '/ocr/lang/deu.traineddata.gz']) {
    assert.equal((await fetch(base + asset, { method: 'HEAD' })).status, 200, 'Missing OCR asset: ' + asset);
  }
  assert.equal((await fetch(base + '/inventory/data', { redirect: 'manual' })).status, 302);
  if (mode === 'init') {
    const password = 'Test1-' + randomBytes(24).toString('hex');
    const response = await fetch(base + '/auth/register', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'container-test@example.com', password, confirmPassword: password }) });
    assert.equal(response.status, 302, 'Registration must succeed');
    const root = await fetch(base + '/', { redirect: 'manual' }); assert.equal(root.status, 302); assert.equal(root.headers.get('location'), '/inventory');
    const login = await fetch(base + '/auth/login'); const loginHtml = await login.text();
    assert.equal((loginHtml.match(/class="app-header"/g) || []).length, 1);
    assert(loginHtml.includes('method="POST" action="/auth/login" hx-boost="false"'));
    const signIn = await fetch(base + '/auth/login', { method: 'POST', redirect: 'manual', body: new URLSearchParams({ email: 'container-test@example.com', password }) });
    assert.equal(signIn.status, 302); assert.equal(signIn.headers.get('location'), '/inventory');
    const cookie = response.headers.get('set-cookie')?.split(';')[0]; assert(cookie);
    const wardrobe = await fetch(base + '/wardrobe', { redirect: 'manual', headers: { Cookie: cookie } }); assert.equal(wardrobe.status, 302); assert.equal(wardrobe.headers.get('location'), '/inventory');
    const created = await fetch(base + '/wardrobe', { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'Container-Test', category: 'Kleidung', material: '100 % Baumwolle', articleNumber: 'TEST-123', size: 'Kragen 15¾″' }) });
    assert.equal(created.status, 302, 'Garment creation must succeed');
    const snapshot = await (await fetch(base + '/inventory/data', { headers: { Cookie: cookie } })).json();
    const garment = snapshot.garments.find(g => g.name === 'Container-Test'); assert(garment);
    const changed = await fetch(base + '/inventory/actions', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Inventory-Request': '1' }, body: JSON.stringify({ type: 'stock', revision: snapshot.revision, garmentId: garment.id, bins: [{ location: 'home-a', status: 'available', quantity: 3 }] }) });
    assert.equal(changed.status, 201);
    const capture = new URLSearchParams({ name: 'Capture-Test', category: 'Pullover', initialLocation: 'home-b', initialQuantity: '2', captureToken: randomUUID() });
    const captureRequest = () => fetch(base + '/wardrobe', { method: 'POST', redirect: 'manual', headers: { Cookie: cookie }, body: capture });
    const firstCapture = await captureRequest(); assert.equal(firstCapture.status, 302);
    const repeatCapture = await captureRequest(); assert.equal(repeatCapture.status, 302); assert.equal(repeatCapture.headers.get('location'), firstCapture.headers.get('location'));
    const capturedSnapshot = await (await fetch(base + '/inventory/data', { headers: { Cookie: cookie } })).json();
    const captured = capturedSnapshot.garments.filter(g => g.name === 'Capture-Test');
    assert.equal(captured.length, 1); assert.deepEqual(captured[0].bins, [{ location: 'home-b', status: 'available', quantity: 2 }]);
    fs.writeFileSync(stateFile, JSON.stringify({ cookie, id: garment.id }), { mode: 0o600 });
  } else if (mode === 'verify') {
    const { cookie, id } = JSON.parse(fs.readFileSync(stateFile));
    const response = await fetch(base + '/inventory/data', { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(response.status, 200, 'Session secret must survive restart');
    const snapshot = await response.json();
    assert.deepEqual(snapshot.garments.find(g => g.id === id).bins, [{ location: 'home-a', status: 'available', quantity: 3 }]);
    const backup = await (await fetch(base + '/inventory/backup', { headers: { Cookie: cookie } })).json();
    assert.equal(backup.garments[0].name, 'Container-Test');
    assert.equal(backup.garments[0].material, '100 % Baumwolle');
    assert.equal(backup.garments[0].articleNumber, 'TEST-123');
    assert.equal(backup.garments[0].size, 'Kragen 15¾″');
    const registration = await fetch(base + '/auth/register', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'blocked@example.com', password: 'not-used', confirmPassword: 'not-used' }) });
    assert.equal(registration.status, 302); assert.equal(registration.headers.get('location'), '/auth/login');
  } else throw Error('Unknown test mode');
  console.log(`PASS ${mode}: authentication, stock, session/data persistence and registration switch`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });

