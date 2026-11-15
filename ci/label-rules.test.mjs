import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLabel } from '../meine_kleidung/public/js/label-rules.mjs';
const values = (text, field = 'size', options) => parseLabel(text, options).filter(s => s.field === field).map(s => s.value);

for (const text of ['31x34', '31×34', 'W31 L34', 'W 31 / L 34', 'W31\nL34']) {
  test(`Jeans ${JSON.stringify(text)}`, () => assert(values(text).includes('W31 / L34')));
}
for (const [text, expected] of [['15¼', 'Kragen 15¼″'], ['15 1/4', 'Kragen 15¼″'], ['15,25', 'Kragen 15¼″'], ['15¾', 'Kragen 15¾″'], ['15 3/4', 'Kragen 15¾″'], ['15½', 'Kragen 15½″']]) {
  test(`Hemd-Viertelgröße ${text}`, () => assert(values(text, 'size', { category: 'Hemd' }).includes(expected)));
}
test('Kragen mit Einheit', () => {
  assert(values('Kragenweite: 40 cm').includes('Kragen 40 cm'));
  assert(values('Collar: 15 3/4 inch').includes('Kragen 15¾″'));
});
test('Kragen und Ärmel zusammen', () => assert(values('15½ 34/35', 'size', { category: 'Hemd' }).includes('Kragen 15½″ / Ärmel 34/35″')));
test('Viertel-Doppelgrößen und Bindestrich-Schreibweise', () => {
  assert(values('15½/15¾', 'size', { category: 'Hemd' }).includes('Kragen 15½/15¾″'));
  assert(values('15-1/4', 'size', { category: 'Hemd' }).includes('Kragen 15¼″'));
  assert(values('15¾ / 34/35', 'size', { category: 'Hemd' }).includes('Kragen 15¾″ / Ärmel 34/35″'));
});
test('Hemd-Doppelgröße bleibt Doppelgröße', () => assert.deepEqual(values('39/40', 'size', { category: 'Hemd' }), ['39/40']));
test('Regionale Größen mit halben Werten werden nicht umgerechnet', () => {
  assert(values('EU 42½\nUK 8¼').includes('EU 42½'));
  assert(values('EU 42½\nUK 8¼').includes('UK 8¼'));
});
test('Mehrere internationale Größen bleiben zur Auswahl', () => assert.deepEqual(values('EU 48\nUS 38\nM'), ['EU 48', 'US 38', 'M']));
test('Buchstaben, Doppelgrößen, Kinder- und BH-Größen', () => {
  for (const text of ['XXL', '3XL', 'S/M', '92/98', 'Size: 75B']) assert(values(text).length);
  assert.deepEqual(values('One Size'), ['Einheitsgröße']);
});
test('Nackte Zahl und OCR-Ziffernverwechslung sind unsicher', () => {
  assert(parseLabel('40').find(s => s.value === '40').uncertain);
  assert(parseLabel('3Ix34').find(s => s.value === 'W31 / L34').uncertain);
  assert(!values('40').some(v => /EU|Kragen/.test(v)));
});
test('Prozente, Waschsymbole und Registriernummern sind keine Größen', () => {
  assert.deepEqual(values('100% COTTON\nRN 14806\nCA 00342\n30°C\nMADE IN PORTUGAL'), []);
  assert.deepEqual(values('RN 14806\nCA 00342', 'articleNumber'), []);
});
test('Material und Artikelnummer', () => {
  assert.deepEqual(values('98% COTTON\n2% ELASTANE', 'material'), ['98 % Baumwolle, 2 % Elasthan']);
  assert.deepEqual(values('Style No. I028426', 'articleNumber'), ['I028426']);
  assert.deepEqual(values('Art.-Nr.:I028426', 'articleNumber'), ['I028426']);
});
test('Unvollständige Materialmischung bleibt unsicher', () => assert(parseLabel('80% Cotton').find(s => s.field === 'material').uncertain));
test('Marke, bekannte eigene Marke und OCR-Tippfehler', () => {
  assert.deepEqual(values('Carhartt WIP', 'brand'), ['Carhartt WIP']);
  assert(values('Meine Hausmarke', 'brand', { knownBrands: ['Meine Hausmarke'] }).includes('Meine Hausmarke'));
  assert(parseLabel('Cartharrtt').find(s => s.value === 'Carhartt').uncertain);
});
test('Keine erfundenen Angaben aus beliebigem Text', () => assert.deepEqual(parseLabel('KEEP AWAY FROM FIRE\nMADE IN PORTUGAL\n0123456789012'), []));
test('Gedruckte Pflegeanweisung bleibt Text', () => assert.deepEqual(values('Machine wash 30°C\nDo not tumble dry', 'washingDetails'), ['Machine wash 30°C\nDo not tumble dry']));
