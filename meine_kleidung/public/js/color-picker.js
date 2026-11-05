(() => {
  'use strict';
  async function init(det) {
    if (det.dataset.ready) return;
    det.dataset.ready = 'true';
    const label = (value) => window.ClosetColors.label(value);
    const options = det.querySelector('.ms-options');
    const pills = det.querySelector('.ms-pills');
    const search = det.querySelector('.ms-search-input');
    const create = det.querySelector('.ms-create');
    const state = new Map(
      [...options.querySelectorAll('input')].map((input) => [
        input.value,
        input.checked,
      ]),
    );
    const known = [...window.KNOWN_COLORS];
    let prefs = { hiddenColors: [], customColors: [], routes: [] };
    let loading = true;
    const manage = document.createElement('div');
    manage.className = 'ms-manage';
    const restore = document.createElement('button');
    restore.type = 'button';
    restore.textContent = 'Entfernte Farben wieder anzeigen';
    const feedback = document.createElement('p');
    feedback.className = 'ms-feedback';
    feedback.setAttribute('role', 'status');
    manage.append(restore, feedback);
    det.querySelector('.ms-dropdown').append(manage);
    const inputs = () => [...options.querySelectorAll('input')];
    function renderPills() {
      pills.replaceChildren();
      const checked = inputs().filter((input) => input.checked);
      if (!checked.length) {
        const placeholder = document.createElement('span');
        placeholder.className = 'ms-placeholder';
        placeholder.textContent = 'Farbe auswählen';
        pills.append(placeholder);
      }
      for (const input of checked) {
        const pill = document.createElement('span');
        pill.className = 'ms-pill badge badge-ghost';
        const name = document.createElement('span');
        name.textContent = label(input.value);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ms-pill-remove badge badge-sm badge-neutral';
        remove.textContent = '×';
        remove.setAttribute('aria-label', label(input.value) + ' abwählen');
        remove.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          input.checked = false;
          state.set(input.value, false);
          renderPills();
          filter();
        });
        pill.append(name, remove);
        pills.append(pill);
      }
      det.querySelector('.ms-count').textContent =
        `${checked.length} ausgewählt`;
    }
    function filter() {
      const query = search.value.trim().toLocaleLowerCase('de');
      let count = 0;
      for (const row of options.children) {
        const input = row.querySelector('input');
        row.hidden =
          (prefs.hiddenColors.includes(input.value) && !input.checked) ||
          !`${label(input.value)} ${input.value}`
            .toLocaleLowerCase('de')
            .includes(query);
        if (!row.hidden) count++;
      }
      det.querySelector('.ms-empty').style.display = count ? 'none' : 'block';
      const exists = inputs().some(
        (input) =>
          (input.value.toLocaleLowerCase('de') === query ||
            label(input.value).toLocaleLowerCase('de') === query) &&
          !prefs.hiddenColors.includes(input.value),
      );
      det.querySelector('.ms-create-label').textContent = search.value.trim();
      create.style.display = query && !exists && !loading ? 'flex' : 'none';
      restore.hidden = !prefs.hiddenColors.length;
      restore.disabled = loading;
    }
    async function save(patch) {
      if (loading) return false;
      loading = true;
      render();
      feedback.textContent = '';
      try {
        const response = await fetch('/inventory/actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Inventory-Request': '1',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            type: 'preferences',
            revision,
            preferences: patch,
          }),
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(
            result.message || 'Farben konnten nicht gespeichert werden.',
          );
        revision = result.revision;
        prefs = { ...prefs, ...patch };
        return true;
      } catch (error) {
        feedback.textContent = error.message;
        return false;
      } finally {
        loading = false;
        render();
      }
    }
    function render() {
      options.replaceChildren();
      for (const value of new Set([
        ...known,
        ...prefs.customColors,
        ...state.keys(),
      ])) {
        const row = document.createElement('div');
        row.className = 'ms-option-wrap';
        const option = document.createElement('label');
        option.className = 'ms-option';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = 'color';
        input.value = value;
        input.checked = state.get(value) || false;
        input.addEventListener('change', () => {
          state.set(value, input.checked);
          renderPills();
          filter();
        });
        const name = document.createElement('span');
        name.textContent = label(value);
        option.append(input, name);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'ms-delete';
        remove.disabled = loading;
        remove.setAttribute(
          'aria-label',
          label(value) + ' aus Farbliste entfernen',
        );
        remove.title = 'Aus Farbliste entfernen';
        remove.innerHTML =
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>';
        remove.addEventListener('click', async () => {
          if (
            await save({
              hiddenColors: [...new Set([...prefs.hiddenColors, value])],
            })
          ) {
            state.set(value, false);
            render();
          }
        });
        row.append(option, remove);
        options.append(row);
      }
      filter();
      renderPills();
    }
    async function add() {
      const query = search.value.trim();
      if (!query || loading) return;
      if (query.length > 60) {
        feedback.textContent = 'Bitte höchstens 60 Zeichen verwenden.';
        return;
      }
      const value =
        [...state.keys(), ...known, ...prefs.customColors].find(
          (value) =>
            label(value).toLocaleLowerCase('de') ===
              query.toLocaleLowerCase('de') ||
            value.toLocaleLowerCase('de') === query.toLocaleLowerCase('de'),
        ) || query;
      if (
        await save({
          customColors: known.includes(value)
            ? prefs.customColors
            : [...new Set([...prefs.customColors, value])],
          hiddenColors: prefs.hiddenColors.filter((color) => color !== value),
        })
      ) {
        state.set(value, true);
        search.value = '';
        render();
      }
    }
    search.addEventListener('input', filter);
    search.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (create.style.display !== 'none') add();
      }
    });
    create.addEventListener('click', add);
    restore.addEventListener('click', () => save({ hiddenColors: [] }));
    det.querySelector('.ms-clear').addEventListener('click', () => {
      for (const key of state.keys()) state.set(key, false);
      search.value = '';
      render();
    });
    let revision;
    render();
    try {
      const response = await fetch('/inventory/data', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok || response.redirected)
        throw new Error('Farbliste nicht geladen. Bitte die Seite neu laden.');
      const data = await response.json();
      prefs = data.preferences || prefs;
      revision = data.revision;
      for (const garment of data.garments)
        for (const color of (garment.color || '')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean))
          if (!state.has(color)) state.set(color, false);
      loading = false;
    } catch (error) {
      feedback.textContent = error.message;
    }
    render();
  }
  const initAll = () => document.querySelectorAll('.color-ms').forEach(init);
  document.addEventListener('DOMContentLoaded', initAll);
  document.addEventListener('htmx:afterSwap', initAll);
  document.addEventListener('click', (event) =>
    document.querySelectorAll('.color-ms[open]').forEach((det) => {
      if (!det.contains(event.target)) det.open = false;
    }),
  );
})();
