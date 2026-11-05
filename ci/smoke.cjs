const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
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
  assert.equal((await fetch(base + '/inventory/data', { redirect: 'manual' })).status, 302);
  if (mode === 'init') {
    const password = randomBytes(24).toString('hex');
    const response = await fetch(base + '/auth/register', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'container-test@example.com', password, confirmPassword: password }) });
    assert.equal(response.status, 302);
    const cookie = response.headers.get('set-cookie')?.split(';')[0]; assert(cookie);
    const created = await fetch(base + '/wardrobe', { method: 'POST', redirect: 'manual', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'Container-Test', category: 'Kleidung' }) });
    assert.equal(created.status, 302);
    const snapshot = await (await fetch(base + '/inventory/data', { headers: { Cookie: cookie } })).json();
    const garment = snapshot.garments.find(g => g.name === 'Container-Test'); assert(garment);
    const changed = await fetch(base + '/inventory/actions', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', 'X-Inventory-Request': '1' }, body: JSON.stringify({ type: 'stock', revision: snapshot.revision, garmentId: garment.id, bins: [{ location: 'home-a', status: 'available', quantity: 3 }] }) });
    assert.equal(changed.status, 201);
    fs.writeFileSync(stateFile, JSON.stringify({ cookie, id: garment.id }), { mode: 0o600 });
  } else if (mode === 'verify') {
    const { cookie, id } = JSON.parse(fs.readFileSync(stateFile));
    const response = await fetch(base + '/inventory/data', { headers: { Cookie: cookie }, redirect: 'manual' });
    assert.equal(response.status, 200, 'Session secret must survive restart');
    const snapshot = await response.json();
    assert.deepEqual(snapshot.garments.find(g => g.id === id).bins, [{ location: 'home-a', status: 'available', quantity: 3 }]);
    const backup = await (await fetch(base + '/inventory/backup', { headers: { Cookie: cookie } })).json();
    assert.equal(backup.garments[0].name, 'Container-Test');
    const registration = await fetch(base + '/auth/register', { method: 'POST', redirect: 'manual', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'blocked@example.com', password: 'not-used', confirmPassword: 'not-used' }) });
    assert.equal(registration.status, 302); assert.equal(registration.headers.get('location'), '/auth/login');
  } else throw Error('Unknown test mode');
  console.log(`PASS ${mode}: authentication, stock, session/data persistence and registration switch`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
