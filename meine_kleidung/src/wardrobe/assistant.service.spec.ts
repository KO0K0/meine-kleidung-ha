import { AssistantService, validateAssistantPlan } from './assistant.service';

const snapshot: any = { revision: 7, locations: [{ id: 'a', name: 'Turmstraße' }, { id: 'b', name: 'Vogelsgesang' }], garments: [{ id: 1, name: 'Zip-Hoodie', category: 'Pullover', bins: [{ location: 'a', status: 'available', quantity: 3 }] }, { id: 2, name: 'Jeans', bins: [{ location: 'b', status: 'laundry', quantity: 1 }] }] };
const move = { kind: 'transfer', items: [{ garmentId: 1, location: 'a', status: 'available', quantity: 1 }], destination: 'b' };
describe('assistant validates model proposals against real stock', () => {
  it('prepares a revision-bound move without changing stock', () => {
    const before = JSON.stringify(snapshot);
    expect(validateAssistantPlan(move, snapshot)).toMatchObject({ kind: 'transfer', action: { revision: 7, type: 'transfer', entries: move.items, destination: 'b' } });
    expect(JSON.stringify(snapshot)).toBe(before);
  });
  it.each([
    { ...move, items: [{ ...move.items[0], quantity: 4 }] },
    { ...move, items: [{ ...move.items[0], garmentId: 999 }] },
    { ...move, destination: 'missing' },
    { ...move, items: [...move.items, ...move.items] },
    { kind: 'delete', items: [1] },
    { kind: 'query', items: [999] },
    { kind: 'query', items: [1], status: 'missing' },
  ])('rejects invented or unsupported actions: %j', plan => expect(() => validateAssistantPlan(plan, snapshot)).toThrow());
  it('returns questions without preparing mutations', () => expect(validateAssistantPlan({ kind: 'question', question: 'Welchen Hoodie meinst du?' }, snapshot)).toEqual({ kind: 'question', question: 'Welchen Hoodie meinst du?' }));
  it('answers from actual bins rather than generated prose', () => expect(validateAssistantPlan({ kind: 'query', items: [2], location: 'b', status: 'laundry' }, snapshot)).toMatchObject({ kind: 'query', garments: [{ id: 2, bins: [{ quantity: 1 }] }] }));
});

describe('assistant provider adapters', () => {
  let oldFetch: typeof fetch;
  const oldEnv = { ...process.env };
  beforeEach(() => { oldFetch = global.fetch; for (const p of ['GROQ','CLOUDFLARE','OPENROUTER','GEMINI']) process.env[`ASSISTANT_${p}_KEY`] = 'test-only-key'; process.env.ASSISTANT_CLOUDFLARE_ACCOUNT = 'a'.repeat(32); });
  afterEach(() => { global.fetch = oldFetch; process.env = { ...oldEnv }; });
  it.each(['groq','cloudflare','openrouter','gemini'])('reads %s response and sends only required catalog fields', async provider => {
    let sent: any;
    global.fetch = jest.fn(async (_url, options) => {
      sent = JSON.parse(String(options?.body));
      return new Response(JSON.stringify(provider === 'cloudflare' ? { result: { response: JSON.stringify(move) } } : { choices: [{ message: { content: JSON.stringify(move) } }] }), { status: 200 });
    }) as any;
    const service = new AssistantService({ snapshot: async () => snapshot } as any);
    const answer = await service.understand({ provider, turns: [{ role: 'user', content: 'Einen Hoodie nach Vogelsgesang' }] });
    expect(answer.kind).toBe('transfer'); expect(sent.messages[0].content).not.toContain('test-only-key');
    expect(service.providers().some(p => Object.hasOwn(p, 'key'))).toBe(false);
  });
  it('uses the Google endpoint and Gemini model without reusing an old Mistral key', async () => {
    delete process.env.ASSISTANT_GEMINI_KEY;
    process.env.ASSISTANT_MISTRAL_KEY = 'old-provider-secret';
    const service = new AssistantService({ snapshot: async () => snapshot } as any);
    expect(service.providers().find(p => p.id === 'gemini')?.configured).toBe(false);
    expect(service.providers().some(p => p.id === ('mistral' as any))).toBe(false);
    process.env.ASSISTANT_GEMINI_KEY = 'google-test-key';
    global.fetch = jest.fn(async (url, options) => {
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
      expect((options?.headers as any).Authorization).toBe('Bearer google-test-key');
      expect(JSON.parse(String(options?.body))).toMatchObject({ model: 'gemini-2.5-flash-lite', response_format: { type: 'json_object' } });
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ kind: 'question', question: 'Welchen Hoodie meinst du?' }) } }] }));
    }) as any;
    expect(await service.understand({ provider: 'gemini', turns: [{ role: 'user', content: 'Einen Hoodie waschen' }] })).toMatchObject({ kind: 'question', provider: 'gemini' });
  });
  it('handles provider quota exhaustion without retrying or exposing response secrets', async () => {
    global.fetch = jest.fn(async () => new Response('secret debug text', { status: 429 })) as any;
    const service = new AssistantService({ snapshot: async () => snapshot } as any);
    await expect(service.understand({ provider: 'groq', turns: [{ role: 'user', content: 'Hallo' }] })).rejects.toThrow('Anbieterlimit');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    [400, 'Anfrage abgelehnt'], [401, 'API-Schlüssel prüfen'], [402, 'kostenlos'],
    [403, 'Schlüsselbeschränkungen'], [404, 'Modell oder API-Endpunkt'], [503, 'nicht verfügbar'],
  ])('reports HTTP %s without forwarding provider text', async (status, expected) => {
    global.fetch = jest.fn(async () => new Response('secret-key and private catalog', { status: status as number })) as any;
    const service = new AssistantService({ snapshot: async () => snapshot } as any);
    const error = await service.understand({ provider: 'gemini', turns: [{ role: 'user', content: 'Hallo' }] }).catch(e => e);
    expect(error.message).toContain(`Google AI Studio · Gemini (HTTP ${status})`);
    expect(error.message).toContain(expected);
    expect(error.message).not.toContain('secret-key');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
  it.each(['API_KEY_INVALID', 'API_KEY_SERVICE_BLOCKED', 'SERVICE_DISABLED', 'BILLING_DISABLED'])('translates only a known error reason: %s', async reason => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ error: { message: 'secret-key', details: [{ reason, metadata: { key: 'secret-key' } }] } }), { status: 400 })) as any;
    const service = new AssistantService({ snapshot: async () => snapshot } as any);
    const error = await service.understand({ provider: 'gemini', turns: [{ role: 'user', content: 'Hallo' }] }).catch(e => e);
    expect(error.message).not.toContain('Anfrage abgelehnt');
    expect(error.message).not.toContain('secret-key');
  });
  it('ignores unrecognized and inherited provider reasons', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ error: { details: [{ reason: 'toString' }, { reason: 'secret-key' }] } }), { status: 400 })) as any;
    const service = new AssistantService({ snapshot: async () => snapshot } as any);
    await expect(service.understand({ provider: 'gemini', turns: [{ role: 'user', content: 'Hallo' }] })).rejects.toThrow('Anfrage abgelehnt');
  });
});
