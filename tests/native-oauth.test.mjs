import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.NOSSA_SESSAO_NATIVE = '1';
const { env } = await import('../server/src/env.js');
env.appToken = 'test-only-server-key';
const { startNativeLogin, completeNativeLogin, pollNativeLogin, validNativePlaylistToken } = await import('../server/src/lib/nativeOAuth.js');
const { requireAppToken } = await import('../server/src/middleware/auth.js');

test('autorização nativa exige o segredo do aparelho e emite acesso limitado ao perfil', () => {
  const login = startNativeLogin('eduardo');
  assert.deepEqual(pollNativeLogin(login.id, login.pollSecret), { status: 'pending' });
  completeNativeLogin(login, 'eduardo', true);
  assert.deepEqual(pollNativeLogin(login.id, 'outro-aparelho'), { status: 'expired' });
  const { token, status } = pollNativeLogin(login.id, login.pollSecret);
  assert.equal(status, 'connected'); assert.ok(!token.includes(env.appToken));
  assert.equal(validNativePlaylistToken(token, 'eduardo'), true);
  assert.equal(validNativePlaylistToken(token, 'laura'), false);
  assert.equal(validNativePlaylistToken(token + 'x', 'eduardo'), false);
  assert.equal(validNativePlaylistToken(token + '.extra', 'eduardo'), false);
  let passed = false, rejected = false;
  const response = { status: () => ({ json: () => { rejected = true; } }) };
  const request = { method: 'POST', originalUrl: '/api/import/playlist', body: { profile: 'eduardo' }, query: {}, headers: { 'x-app-token': token } };
  requireAppToken(request, response, () => { passed = true; }); assert.equal(passed, true);
  passed = false; requireAppToken({ ...request, originalUrl: '/api/iptv/parse' }, response, () => { passed = true; });
  assert.equal(passed, false); assert.equal(rejected, true);
});
test('cancelamento e sessão expirada não liberam token', () => {
  const login = startNativeLogin('laura'); completeNativeLogin(login, 'laura', false);
  assert.deepEqual(pollNativeLogin(login.id, login.pollSecret), { status: 'error' });
  completeNativeLogin({ ...login, expires: 0 }, 'laura', true);
  assert.equal(pollNativeLogin(login.id, login.pollSecret).token, undefined);
});
