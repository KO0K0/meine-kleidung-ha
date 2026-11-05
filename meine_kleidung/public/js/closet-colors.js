(() => {
  const labels = {
    red: 'Rot',
    pink: 'Rosa',
    orange: 'Orange',
    yellow: 'Gelb',
    green: 'Grün',
    blue: 'Blau',
    purple: 'Lila',
    black: 'Schwarz',
    white: 'Weiß',
    grey: 'Grau',
    gray: 'Grau',
    beige: 'Beige',
    brown: 'Braun',
    gold: 'Gold',
    silver: 'Silber',
    pattern: 'Gemustert',
    other: 'Sonstige',
  };
  window.ClosetColors = {
    label: (value) => (Object.hasOwn(labels, value) ? labels[value] : value),
    format: (value) =>
      String(value || '')
        .split(',')
        .map((value) => window.ClosetColors.label(value.trim()))
        .join(', '),
  };
})();
