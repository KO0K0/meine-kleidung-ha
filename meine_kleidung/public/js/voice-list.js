/* Text matching stays on this device. Dictation is provided by the keyboard. */
(() => {
  'use strict';
  const normalize = (text) =>
    String(text)
      .toLocaleLowerCase('de')
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]/g, '');
  const numbers = {
    ein: 1,
    eine: 1,
    einen: 1,
    eins: 1,
    zwei: 2,
    drei: 3,
    vier: 4,
    fünf: 5,
    sechs: 6,
    sieben: 7,
    acht: 8,
    neun: 9,
    zehn: 10,
    elf: 11,
    zwölf: 12,
  };
  const singular = (text) => {
    const word = normalize(text).replace(/s$/, '');
    return word.length > 4 ? word.replace(/(?:en|e)$/, '') : word;
  };
  function distance(a, b) {
    let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++)
        next[j] = Math.min(
          next[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      previous = next;
    }
    return previous[b.length];
  }
  window.ClosetVoice = {
    parse(text, garments, location) {
      const available = garments.filter((g) =>
        g.bins.some(
          (b) =>
            b.location === location &&
            b.status === 'available' &&
            b.quantity > 0,
        ),
      );
      return text
        .split(/[,;\n.!?]+|\s+und\s+/i)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const match = part.match(
            /^(\d+|ein|eine|einen|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s*(?:[x×]\s*|\s+)(.+)$/i,
          );
          const quantity = match
            ? Number(numbers[match[1].toLowerCase()] ?? match[1])
            : 1;
          const query = match ? match[2] : part;
          const needle = normalize(query);
          const exact = available.filter((g) => normalize(g.name) === needle);
          let candidates = exact.length
            ? exact
            : available.filter(
                (g) =>
                  needle &&
                  (normalize(g.name || g.category).includes(needle) ||
                    singular(g.name || g.category).includes(singular(query))),
              );
          let uncertain = false;
          if (!candidates.length && needle.length >= 4) {
            uncertain = true;
            candidates = available.filter((g) => {
              const terms = [
                g.name || g.category,
                ...(g.name || '').split(/[\s-]+/),
              ];
              return terms.some(
                (term) =>
                  distance(singular(term), singular(query)) <=
                  (needle.length >= 8 ? 2 : 1),
              );
            });
          }
          return {
            query,
            quantity,
            candidates,
            uncertain,
            garmentId:
              candidates.length === 1 && !uncertain ? candidates[0].id : '',
          };
        });
    },
  };
})();
