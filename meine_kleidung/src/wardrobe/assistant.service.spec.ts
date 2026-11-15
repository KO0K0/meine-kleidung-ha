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
  beforeEach(() => { oldFetch = global.fetch; for (const p of ['GROQ','CLOUDFLARE','OPENROUTER','MISTRAL']) process.env[`ASSISTANT_${p}_KEY`] = 'test-only-key'; process.env.ASSISTANT_CLOUDFLARE_ACCOUNT = 'a'.repeat(32); });
  afterEach(() => { global.fetch = oldFetch; process.env = { ...oldEnv }; });
  it.each(['groq','cloudflare','openrouter','mistral'])('reads %s response and sends only required catalog fields', async provider => {
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
  it('handles provider quota exhaustion without retrying or exposing response secrets', async () => {
    global.fetch = jest.fn(async () => new Response('secret debug text', { status: 429 })) as any;
    const service = new AssistantService({ snapshot: async () => snapshot } as any);
    await expect(service.understand({ provider: 'groq', turns: [{ role: 'user', content: 'Hallo' }] })).rejects.toThrow('Anbieterlimit');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
