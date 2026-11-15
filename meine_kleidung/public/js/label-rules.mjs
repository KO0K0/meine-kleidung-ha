// Conservative suggestions, never a size conversion or an automatic form write.
const BRANDS = ['Carhartt WIP', 'Carhartt', "Levi's", 'Nike', 'Adidas', 'Puma', 'Uniqlo', 'H&M', 'Zara', 'COS', 'Arket', 'C&A', 'Patagonia', 'The North Face', 'Columbia', 'Dickies', 'Wrangler', 'Lee', 'G-Star', 'Jack & Jones', 'Tommy Hilfiger', 'Calvin Klein', 'Ralph Lauren', 'Lacoste', 'Hugo Boss', 'Esprit', 'S.Oliver', 'Tom Tailor', 'Marc O’Polo', 'Olymp', 'Eterna', 'Seidensticker', 'Fynch-Hatton', 'Charles Tyrwhitt', 'Hawes & Curtis', 'Falke', 'Schiesser', 'Mey', 'Trigema', 'Engelbert Strauss', 'Birkenstock', 'New Balance', 'Asics', 'Converse', 'Vans', 'Reebok'];
const key = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const fraction = value => String(Number(value)).replace(/\.25$/, '¼').replace(/\.5$/, '½').replace(/\.75$/, '¾');
function normalized(text) {
  return text.replace(/(\d+)\s*¼/g, '$1.25').replace(/(\d+)\s*½/g, '$1.5').replace(/(\d+)\s*¾/g, '$1.75')
    .normalize('NFKC').replace(/⁄/g, '/')
    .replace(/(\d+)(?:\s+|\s*-\s*)(1\s*\/\s*4|1\s*\/\s*2|3\s*\/\s*4)\b/g, (_, whole, part) => String(Number(whole) + ({ '1/4': .25, '1/2': .5, '3/4': .75 })[part.replace(/\s/g, '')]))
    .replace(/(\d),(\d)/g, '$1.$2').replace(/[–—]/g, '-');
}
const num = '(?:\\d{1,3}(?:\\.(?:25|5|75))?)';
const displayNumber = value => value.replace(/\d+(?:\.\d+)?/g, fraction);
function oneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

export function parseLabel(text, { category = '', knownBrands = [] } = {}) {
  const source = String(text).slice(0, 12000);
  const lines = source.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const suggestions = [];
  const add = (field, value, reason, uncertain = false) => {
    value = value?.trim();
    if (value && !suggestions.some(s => s.field === field && s.value.toLowerCase() === value.toLowerCase())) suggestions.push({ field, value, reason, uncertain });
  };
  const shirt = /hemd|shirt|bluse|blouse|chemise|kragen|collar|neck|kragenweite/i.test(category + ' ' + source);
  const denim = /jeans|hose|trousers|denim|waist|inseam|bundweite|beinlänge/i.test(category + ' ' + source);
  const brands = [...new Set([...knownBrands.filter(v => typeof v === 'string' && v.length <= 100), ...BRANDS])].sort((a, b) => b.length - a.length);
  const recognizedBrands = [];
  for (const brand of brands) {
    if (recognizedBrands.some(longer => key(longer).includes(key(brand)))) continue;
    const tokens = brand.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/gi) ?? [];
    const pattern = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s’\x27.&-]*');
    if (pattern && new RegExp(`(?:^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`, 'i').test(source.normalize('NFKD').replace(/[\u0300-\u036f]/g, ''))) {
      add('brand', brand, 'Markenname im Etiketttext gefunden.'); recognizedBrands.push(brand);
    }
  }
  for (const line of lines) {
    const brand = line.match(/^(?:marke|brand)\s*[:=-]\s*(.{2,80})$/i);
    if (brand) add('brand', brand[1], 'Explizite Markenangabe.');
    if (!recognizedBrands.length && /^[\p{L}’' -]{6,30}$/u.test(line)) {
      const found = brands.find(b => key(b).length >= 6 && (oneEdit(key(line), key(b)) || (key(b) === 'carhartt' && /^(?:cartharrtt|carharrt)$/.test(key(line)))));
      if (found) add('brand', found, `Möglicher Lesefehler bei „${line}“ – bitte prüfen.`, true);
    }
    const s = normalized(line);
    let m;
    // Explicit width / length, including labels split by a line break (handled below).
    const jeans = /\bW(?:AIST)?\s*[:=-]?\s*(\d{2})\s*[/x×-]?\s*L(?:ENGTH)?\s*[:=-]?\s*(\d{2})\b/i;
    const j = s.match(jeans) || s.match(/\b(\d{2})\s*[x×]\s*(\d{2})\b/i);
    if (j && +j[1] >= 20 && +j[1] <= 70 && +j[2] >= 20 && +j[2] <= 50) add('size', `W${j[1]} / L${j[2]}`, 'Bundweite und Beinlänge; keine Umrechnung.');
    const damaged = s.match(/\b([2-6][0-9IlO])\s*[x×]\s*([2-4][0-9IlO])\b/);
    if (!j && damaged) add('size', `W${damaged[1].replace(/[Il]/g, '1').replace(/O/g, '0')} / L${damaged[2].replace(/[Il]/g, '1').replace(/O/g, '0')}`, 'Ziffern waren nicht eindeutig lesbar – mit dem Foto vergleichen.', true);

    const neckSleeve = s.match(/\b(1[2-9]|2[0-4])((?:\.(?:25|5|75))?)\s*(?:["″]|in(?:ch)?|zoll)?(?:\s*\/\s*|\s+)(?:sleeve\s*[:=-]?\s*)?([2-4]\d)\s*[-/]\s*([2-4]\d)\b/i);
    if (shirt && neckSleeve) add('size', `Kragen ${fraction(neckSleeve[1] + neckSleeve[2])}″ / Ärmel ${neckSleeve[3]}/${neckSleeve[4]}″`, 'Hemd: Kragenweite und Ärmelbereich in Zoll.');
    const collar = s.match(new RegExp(`\\b(?:kragen(?:weite)?|collar|neck)\\s*(?:size)?\\s*[:=-]?\\s*(${num})(?:\\s*(cm|inch|in|zoll|["″]))?`, 'i'));
    if (collar) {
      const n = Number(collar[1]);
      const unit = collar[2]?.toLowerCase();
      if (n >= 12 && n <= 24 && unit !== 'cm') add('size', `Kragen ${fraction(n)}″`, 'Kragenweite in Zoll, Bruchteile bleiben erhalten.');
      else if (n >= 30 && n <= 60 && (!unit || unit === 'cm')) add('size', `Kragen ${fraction(n)} cm`, 'Kragenweite in Zentimetern.');
    }
    const regional = new RegExp(`\\b(EU|EUR|DE|UK|US|IT|FR)\\s*[:=-]?\\s*(${num}(?:\\s*[/\\-]\\s*${num})?)(?![\\d.%])`, 'gi');
    while ((m = regional.exec(s))) {
      if (Number(m[2].split(/[/-]/)[0]) > 0) add('size', `${m[1].toUpperCase() === 'EUR' ? 'EU' : m[1].toUpperCase()} ${displayNumber(m[2].replace(/\s/g, ''))}`, 'Größensystem wie auf dem Etikett, ohne Umrechnung.');
    }
    const sized = s.replace(/^(?:size|gr[oö](?:ß|ss)e|taille|taglia)\s*[:=-]?\s*/i, '').trim();
    const explicit = sized !== s;
    const collarPair = sized.match(new RegExp(`^(${num})\\s*[/\\-]\\s*(${num})\\s*(?:["″]|inch|in|zoll)?$`, 'i'));
    if (shirt && collarPair && +collarPair[1] >= 12 && +collarPair[1] <= 24 && +collarPair[2] >= 12 && +collarPair[2] <= 24) add('size', `Kragen ${fraction(collarPair[1])}/${fraction(collarPair[2])}″`, 'Hemd-Doppelgröße in Zoll; Viertelwerte bleiben erhalten.');
    const alpha = sized.match(/^(XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-8]XL|XX-SMALL|X-SMALL|SMALL|MEDIUM|LARGE|X-LARGE|XX-LARGE)(?:\s*[/\-]\s*(XS|S|M|L|XL|XXL))?$/i);
    if (alpha) add('size', alpha[0].toUpperCase().replace(/\s/g, ''), 'Internationale Buchstabengröße.');
    if (/^(one\s*size(?:\s*fits\s*all)?|einheitsgr[oö](?:ß|ss)e|OSFA|O\/S)$/i.test(sized)) add('size', 'Einheitsgröße', 'Einheitsgröße ausgeschrieben oder eindeutig abgekürzt.');
    const pair = sized.match(/^(\d{2,3})\s*[/\-]\s*(\d{2,3})$/);
    if (pair && !j) {
      if (denim && +pair[1] >= 20 && +pair[1] <= 70 && +pair[2] >= 20 && +pair[2] <= 50 && Math.abs(+pair[1] - +pair[2]) > 2) add('size', `W${pair[1]} / L${pair[2]}`, 'Mögliche Jeansgröße mit Schrägstrich – bitte prüfen.', true);
      else add('size', `${pair[1]}/${pair[2]}`, shirt ? 'Doppelgröße wie auf dem Hemdetikett.' : 'Doppelgröße oder Bereich, unverändert übernommen.', !explicit && !shirt);
    }
    if (new RegExp(`^${num}$`).test(sized) && Number(sized) > 0) {
      const n = Number(sized);
      if (shirt && n >= 12 && n <= 24 && /\./.test(sized)) add('size', `Kragen ${fraction(n)}″`, 'Mögliche Hemdkragenweite in Zoll – bitte prüfen.', true);
      else add('size', displayNumber(sized), 'Zahl ohne eindeutig angegebenes Größensystem.', !explicit);
    }
    if (/^(?:\d{2,3})\s*[A-K]{1,3}$/i.test(sized)) add('size', sized.toUpperCase().replace(/\s/g, ''), 'Alphanumerische Größe, unverändert übernommen.', !explicit);
    // A shirt label often contains only a quarter-inch value and an inch symbol.
    const inch = sized.match(new RegExp(`^(${num})\\s*(?:["″]|inch|in|zoll)$`, 'i'));
    if (inch) add('size', shirt ? `Kragen ${fraction(inch[1])}″` : `${fraction(inch[1])}″`, 'Größe in Zoll; Halb- und Viertelwerte bleiben erhalten.', !shirt);
    const article = line.match(/(?:^|\b)(?:artikel(?:nummer|[- .]*nr\.?)|art[- .]*nr\.?|style(?:\s*(?:no\.?|number|code))?|product\s*code|ref(?:erence)?\.?)(?:\s*[:#=-]\s*|\s+)([a-z0-9][a-z0-9._/-]{2,79})\b/i);
    if (article && /\d/.test(article[1])) add('articleNumber', article[1], 'Explizite Artikel-/Style-Nummer; RN-/CA-Nummern werden nicht verwendet.');
  }
  const joined = normalized(source);
  const splitJeans = joined.match(/\bW(?:AIST)?\s*[:=-]?\s*(\d{2})\s*[/x×-]?\s*L(?:ENGTH)?\s*[:=-]?\s*(\d{2})\b/i);
  if (splitJeans && +splitJeans[1] >= 20 && +splitJeans[1] <= 70 && +splitJeans[2] >= 20 && +splitJeans[2] <= 50) add('size', `W${splitJeans[1]} / L${splitJeans[2]}`, 'Explizite W-/L-Angaben, auch über mehrere Zeilen.');
  const materials = { cotton: 'Baumwolle', baumwolle: 'Baumwolle', coton: 'Baumwolle', polyester: 'Polyester', polyamid: 'Polyamid', polyamide: 'Polyamid', nylon: 'Nylon', elastane: 'Elasthan', elasthan: 'Elasthan', elastan: 'Elasthan', spandex: 'Elasthan', lycra: 'Elasthan', wool: 'Wolle', wolle: 'Wolle', laine: 'Wolle', merino: 'Merinowolle', linen: 'Leinen', leinen: 'Leinen', lin: 'Leinen', viscose: 'Viskose', viskose: 'Viskose', rayon: 'Viskose', silk: 'Seide', seide: 'Seide', soie: 'Seide', acrylic: 'Polyacryl', polyacryl: 'Polyacryl', acryl: 'Polyacryl', lyocell: 'Lyocell', tencel: 'Lyocell', modal: 'Modal', cashmere: 'Kaschmir', kaschmir: 'Kaschmir', leather: 'Leder', leder: 'Leder' };
  const materialPattern = new RegExp(`\\b(\\d{1,3}(?:\\.\\d+)?)\\s*%\\s*(${Object.keys(materials).join('|')})\\b`, 'gi');
  const components = [];
  let match;
  while ((match = materialPattern.exec(joined))) {
    if (+match[1] > 0 && +match[1] <= 100) {
      const value = `${match[1]} % ${materials[match[2].toLowerCase()]}`;
      if (!components.some(c => c.value === value)) components.push({ value, percent: +match[1] });
    }
  }
  if (components.length) {
    const sum = components.reduce((n, c) => n + c.percent, 0);
    add('material', components.map(c => c.value).join(', '), Math.abs(sum - 100) < .1 ? 'Lesbare Prozentangaben; Materialnamen ins Deutsche vereinheitlicht.' : 'Unvollständige Zusammensetzung oder mehrere Materialbereiche – bitte prüfen.', Math.abs(sum - 100) >= .1);
  }
  const care = lines.filter(line => /\b(?:waschen|handw[aä]sche|maschinenw[aä]sche|wash|lavage|bleichen|bleach|tumble|trockner|b[uü]geln|iron|dry\s*clean|chemisch|nicht\s*trocknen)\b/i.test(line));
  if (care.length) add('washingDetails', [...new Set(care)].join('\n'), 'Gedruckte Pflegehinweise, keine Interpretation von Waschsymbolen.');
  return suggestions;
}
