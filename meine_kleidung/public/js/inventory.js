(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char],
    );
  let data;
  let tab = 'all';
  let busy = false;
  let editId;
  let editRevision;
  let editTotal;
  let undoAction;
  let pendingMove;
  let visible = [];
  const selected = new Map();
  const statusName = (status) =>
    status === 'laundry' ? 'In der Wäsche' : 'Verfügbar';
  const keyFor = (id, bin) => `${id}/${bin.location}/${bin.status}`;
  const sum = (bins) => bins.reduce((total, bin) => total + bin.quantity, 0);
  const washer =
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14"/><circle cx="12" cy="14" r="3"/>';
  const message = (text, error = false) => {
    $('inventory-message').textContent = text;
    $('inventory-message').classList.toggle('error', error);
  };
  const options = (places) =>
    places
      .map(
        (place) =>
          `<option value="${escape(place.id)}">${escape(place.name)}</option>`,
      )
      .join('');
  const setBusy = (value) => {
    busy = value;
    document
      .querySelectorAll('.closet button, .stock-dialog button[type=submit]')
      .forEach((button) => {
        button.disabled = value;
      });
    if ($('stock-dialog').open) updateStockControls();
  };

  async function request(path, body) {
    const response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: {
        Accept: 'application/json',
        ...(body
          ? { 'Content-Type': 'application/json', 'X-Inventory-Request': '1' }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
    });
    if (response.redirected)
      throw new Error(
        'Bitte zuerst anmelden. Öffne dazu „Konto“ unten auf der Seite.',
      );
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.message || 'Speichern fehlgeschlagen. Bitte aktualisieren.',
      );
    return result;
  }

  async function load() {
    data = await request('/inventory/data');
    selected.clear();
    const previousPlace = $('inventory-location').value;
    $('inventory-location').innerHTML =
      '<option value="">Alle Orte</option>' + options(data.locations);
    $('inventory-location').value = previousPlace;
    const destination = $('move-destination');
    const previousDestination =
      destination.value || localStorage.getItem('closet-last-destination');
    destination.innerHTML = options(data.locations);
    if (data.locations.some((place) => place.id === previousDestination))
      destination.value = previousDestination;
    const category = $('inventory-category').value;
    const categories = [
      ...new Set(data.garments.map((garment) => garment.category)),
    ].sort();
    $('inventory-category').innerHTML =
      '<option value="">Alle Kategorien</option>' +
      categories.map((value) => `<option>${escape(value)}</option>`).join('');
    $('inventory-category').value = category;
    render();
    renderPlaces();
  }

  async function refresh() {
    if (busy) return;
    setBusy(true);
    try {
      await load();
      message('Bestand aktualisiert.');
    } catch (error) {
      message(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function change(action) {
    if (busy) return false;
    setBusy(true);
    try {
      const affected = new Set(action.entries?.map((entry) => entry.garmentId));
      const restore =
        action.type === 'transfer'
          ? data.garments
              .filter((garment) => affected.has(garment.id))
              .map(({ id, bins }) => ({ garmentId: id, bins }))
          : [];
      const result = await request('/inventory/actions', {
        revision: data.revision,
        ...action,
      });
      undoAction = restore.length
        ? { type: 'restore', restore, revision: result.revision }
        : undefined;
      $('undo-action').hidden = !undoAction;
      await load();
      message(
        action.type === 'restore'
          ? 'Änderung rückgängig gemacht.'
          : 'Gespeichert.',
      );
      return true;
    } catch (error) {
      message(error.message, true);
      if ($('stock-dialog').open) $('stock-error').textContent = error.message;
      return false;
    } finally {
      setBusy(false);
    }
  }

  function render() {
    if (!data) return;
    const allBins = data.garments.flatMap((garment) => garment.bins);
    $('laundry-count').textContent = sum(
      allBins.filter((bin) => bin.status === 'laundry'),
    );
    $('inventory-stats').innerHTML =
      `<div><strong>${data.garments.length}</strong><span>Artikel</span></div><div><strong>${sum(allBins)}</strong><span>Exemplare gesamt</span></div><div><strong>${sum(allBins.filter((bin) => bin.status === 'available'))}</strong><span>Verfügbar</span></div>`;
    const query = $('inventory-search').value.trim().toLocaleLowerCase();
    const location =
      tab === 'luggage' ? 'luggage' : $('inventory-location').value;
    const status = tab === 'laundry' ? 'laundry' : $('inventory-status').value;
    const category = $('inventory-category').value;
    visible = [];
    const cards = [];
    for (const garment of data.garments) {
      const text = [
        garment.name,
        garment.brand,
        garment.size,
        garment.color,
        window.ClosetColors.format(garment.color),
        garment.category,
        garment.notes,
      ]
        .join(' ')
        .toLocaleLowerCase();
      if (query && !text.includes(query)) continue;
      if (category && garment.category !== category) continue;
      const bins = garment.bins.filter(
        (bin) =>
          (!location || bin.location === location) &&
          (!status || bin.status === status),
      );
      if ((location || status) && !bins.length) continue;
      const rows = bins
        .map((bin) => {
          const key = keyFor(garment.id, bin);
          const index = visible.length;
          visible.push({ key, garmentId: garment.id, ...bin });
          const place =
            data.locations.find((entry) => entry.id === bin.location)?.name ??
            bin.location;
          const status = statusName(bin.status);
          const inLaundry = bin.status === 'laundry';
          const icon = inLaundry ? washer : '<path d="m5 12 4 4L19 6"/>';
          const quickIcon = inLaundry
            ? '<path d="m9 9-5 5 5 5m-5-5h10a5 5 0 0 0 0-10h-1"/>'
            : washer;
          const quickLabel = inLaundry
            ? 'Alle aus der Wäsche'
            : '1 in die Wäsche';
          return `<div class="stock-bin">
            <input type="checkbox" id="bin-${index}" data-select="${index}" aria-label="${escape(garment.name)} in ${escape(place)} auswählen" ${selected.has(key) ? 'checked' : ''}>
            <label for="bin-${index}">${escape(place)}
              <small title="${status}"><svg viewBox="0 0 24 24" role="img" aria-label="${status}">${icon}</svg>×${bin.quantity}</small>
            </label>
            <button type="button" class="quick-wash" data-laundry-bin="${index}" title="${quickLabel}" aria-label="${quickLabel}: ${escape(garment.name || garment.category)} · ${escape(place)}"><svg viewBox="0 0 24 24" aria-hidden="true">${quickIcon}</svg></button>
            <input type="number" data-quantity="${index}" min="1" max="${bin.quantity}" value="${selected.get(key)?.quantity ?? 1}" aria-label="Auswahlmenge ${escape(garment.name)} in ${escape(place)}">
          </div>`;
        })
        .join('');
      const name = escape(garment.name || garment.category);
      const picture = garment.photo
        ? `<img src="/file/nobg/${encodeURIComponent(garment.photo)}" alt="" loading="lazy">`
        : '<svg class="placeholder" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 4-5 2-3 5 4 2 2-2v9h10v-9l2 2 4-2-3-5-5-2a3 3 0 0 1-6 0Z"/></svg>';
      const metadata = escape(
        [garment.brand, garment.size].filter(Boolean).join(' · '),
      );
      cards.push(`<article class="garment-card">
        <button type="button" class="garment-image" data-garment="${garment.id}" aria-label="Optionen für ${name}" aria-haspopup="dialog">
          ${picture}<span class="total">×${sum(garment.bins)}</span><span class="photo-menu-mark" aria-hidden="true">···</span>
        </button>
        <div class="garment-info">
          <h2>${name}</h2>
          ${metadata ? `<p class="garment-meta">${metadata}</p>` : ''}
          ${rows || '<p class="garment-meta">Kein Bestand</p>'}
        </div>
      </article>`);
    }
    $('inventory-grid').innerHTML =
      cards.join('') ||
      `<div class="empty-state"><h2>${tab === 'laundry' ? 'Der Wäschekorb ist leer' : 'Hier ist noch Platz'}</h2><p>${data.garments.length ? 'Passe die Filter an oder verschiebe Artikel hierher.' : 'Füge deinen ersten Artikel hinzu. Danach kannst du Mengen und Orte festlegen.'}</p></div>`;
    updateSelection();
    updateScrollTools();
  }

  function updateSelection() {
    const visibleSelected = visible.filter((entry) =>
      selected.has(entry.key),
    ).length;
    const hiddenSelected = selected.size - visibleSelected;
    $('batch-bar').hidden = selected.size === 0;
    $('selection-count').textContent =
      `${sum([...selected.values()])} Exemplare ausgewählt` +
      (hiddenSelected ? ` · ${hiddenSelected} außerhalb der Ansicht` : '');
    $('select-visible').checked =
      visible.length > 0 && visibleSelected === visible.length;
    $('select-visible').indeterminate =
      visibleSelected > 0 && !$('select-visible').checked;
  }

  function updateScrollTools() {
    $('back-to-top').hidden = window.scrollY <= 120;
    $('floating-search-button').hidden =
      tab === 'places' ||
      $('inventory-search').getBoundingClientRect().bottom > 0;
  }

  function renderPlaces() {
    $('place-list').innerHTML = data.locations
      .map(
        (place) =>
          `<form class="place-form" data-place="${escape(place.id)}"><label>Ortsname<input name="name" value="${escape(place.name)}" required maxlength="60"></label><button>Umbenennen</button></form>`,
      )
      .join('');
  }

  function openStock(id) {
    const garment = data.garments.find((entry) => entry.id === id);
    if (!garment) return;
    editId = id;
    editRevision = data.revision;
    editTotal = sum(garment.bins);
    $('stock-correction').checked = false;
    $('stock-title').textContent = garment.name || garment.category;
    $('stock-error').textContent = '';
    $('stock-inputs').innerHTML = data.locations
      .map(
        (place) =>
          `<div class="stock-row"><span>${escape(place.name)}</span>${[
            'available',
            'laundry',
          ]
            .map((status) => {
              const label = escape(`${place.name} · ${statusName(status)}`);
              const quantity =
                garment.bins.find(
                  (bin) => bin.location === place.id && bin.status === status,
                )?.quantity ?? 0;
              return `<div class="stock-stepper">
            <button type="button" data-step="-1" aria-label="${label}: eins abziehen">−</button>
            <input type="number" inputmode="numeric" min="0" max="10000" step="1" required data-place="${escape(place.id)}" data-status="${status}" value="${quantity}" aria-label="${label}">
            <button type="button" data-step="1" aria-label="${label}: eins hinzufügen">+</button>
          </div>`;
            })
            .join('')}</div>`,
      )
      .join('');
    $('stock-dialog').showModal();
    updateStockControls();
  }

  const stockInputs = () => [...$('stock-inputs').querySelectorAll('input')];

  function updateStockControls() {
    const inputs = stockInputs();
    const total = inputs.reduce(
      (count, input) => count + Number(input.value),
      0,
    );
    const correcting = $('stock-correction').checked;
    const remaining = (correcting ? 10000 : editTotal) - total;
    $('stock-instruction').textContent = correcting
      ? 'Hier kannst du die tatsächlich vorhandene Stückzahl korrigieren.'
      : 'Mit − Stücke abziehen und mit + neu zuweisen.';
    $('stock-pool').textContent = correcting
      ? `Neue Gesamtzahl: ${total}`
      : `${remaining} zu verteilen · ${editTotal} gesamt`;
    for (const input of inputs) {
      input.max = String(Number(input.value) + remaining);
      input.previousElementSibling.disabled = busy || Number(input.value) <= 0;
      input.nextElementSibling.disabled = busy || remaining <= 0;
    }
    $('stock-save').disabled = busy || (!correcting && remaining !== 0);
  }

  document.querySelectorAll('[data-tab]').forEach((button) =>
    button.addEventListener('click', () => {
      tab = button.dataset.tab;
      document
        .querySelectorAll('[data-tab]')
        .forEach((item) =>
          item.setAttribute('aria-pressed', String(item === button)),
        );
      $('inventory-content').hidden = tab === 'places';
      $('inventory-places').hidden = tab !== 'places';
      $('inventory-location').disabled = tab === 'luggage';
      $('inventory-status').disabled = tab === 'laundry';
      render();
    }),
  );
  ['inventory-location', 'inventory-category', 'inventory-status'].forEach(
    (id) => $(id).addEventListener('input', render),
  );
  $('inventory-search').addEventListener('input', (event) => {
    $('floating-search').value = event.target.value;
    render();
  });
  $('floating-search').addEventListener('input', (event) => {
    $('inventory-search').value = event.target.value;
    render();
  });
  $('floating-search-button').addEventListener('click', () => {
    if (!$('floating-search-panel').showPopover) $('inventory-search').focus();
  });
  window.addEventListener('scroll', updateScrollTools, { passive: true });
  window.addEventListener('resize', updateScrollTools);
  $('back-to-top').addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  });
  $('inventory-grid').addEventListener('click', (event) => {
    const quickWash = event.target.closest('[data-laundry-bin]');
    if (quickWash) {
      const { garmentId, location, status, quantity } =
        visible[Number(quickWash.dataset.laundryBin)];
      const inLaundry = status === 'laundry';
      change({
        type: 'transfer',
        entries: [
          { garmentId, location, status, quantity: inLaundry ? quantity : 1 },
        ],
        status: inLaundry ? 'available' : 'laundry',
      });
      return;
    }
    const button = event.target.closest('[data-garment]');
    if (!button) return;
    const garment = data.garments.find(
      (entry) => entry.id === Number(button.dataset.garment),
    );
    if (!garment) return;
    $('garment-menu-title').textContent = garment.name || garment.category;
    $('garment-menu-stock').dataset.garment = String(garment.id);
    $('garment-menu-details').href = `/wardrobe/${garment.id}`;
    $('garment-menu').showModal();
  });
  $('garment-menu-stock').addEventListener('click', (event) => {
    $('garment-menu').close();
    openStock(Number(event.currentTarget.dataset.garment));
  });
  $('garment-menu').addEventListener('click', (event) => {
    if (event.target === $('garment-menu')) $('garment-menu').close();
  });
  $('inventory-grid').addEventListener('change', (event) => {
    const input = event.target;
    const index = input.dataset.select ?? input.dataset.quantity;
    if (index === undefined) return;
    const entry = visible[Number(index)];
    const quantityInput = document.querySelector(`[data-quantity="${index}"]`);
    const checkbox = document.querySelector(`[data-select="${index}"]`);
    if (!quantityInput.checkValidity()) {
      quantityInput.reportValidity();
      checkbox.checked = false;
    }
    if (checkbox.checked)
      selected.set(entry.key, {
        ...entry,
        quantity: Number(quantityInput.value),
      });
    else selected.delete(entry.key);
    updateSelection();
  });
  $('select-visible').addEventListener('change', (event) => {
    for (const entry of visible) {
      if (!event.target.checked) selected.delete(entry.key);
      else if (!selected.has(entry.key))
        selected.set(entry.key, { ...entry, quantity: 1 });
    }
    render();
  });
  $('clear-selection').addEventListener('click', () => {
    selected.clear();
    render();
  });
  const transfer = (target) =>
    change({
      type: 'transfer',
      entries: [...selected.values()].map(({ key, ...entry }) => entry),
      ...target,
    });
  $('wash-selection').addEventListener('click', () =>
    transfer({ status: 'laundry' }),
  );
  $('clean-selection').addEventListener('click', () =>
    transfer({ status: 'available' }),
  );
  $('undo-action').addEventListener('click', () => {
    if (undoAction) change(undoAction);
  });
  $('move-selection').addEventListener('click', () => {
    const destination = $('move-destination').value;
    const target = data.locations.find((place) => place.id === destination);
    if (!target || !selected.size) return;
    const entries = [...selected.values()].map(({ key, ...entry }) => entry);
    pendingMove = {
      type: 'transfer',
      entries,
      destination,
      revision: data.revision,
    };
    $('move-preview-target').textContent = `Zielort: ${target.name}`;
    $('move-preview-entries').replaceChildren(
      ...entries.map((entry) => {
        const garment = data.garments.find(({ id }) => id === entry.garmentId);
        const origin = data.locations.find(({ id }) => id === entry.location);
        const row = document.createElement('li');
        row.textContent = `${entry.quantity} × ${garment.name || garment.category} · ${origin.name} · ${statusName(entry.status)}`;
        return row;
      }),
    );
    $('move-preview').returnValue = '';
    $('move-preview').showModal();
  });
  $('move-preview').addEventListener('close', async (event) => {
    const action = pendingMove;
    pendingMove = undefined;
    if (
      event.currentTarget.returnValue === 'confirm' &&
      action &&
      (await change(action))
    ) {
      localStorage.setItem('closet-last-destination', action.destination);
    }
  });
  let voiceRows = [];
  let voiceRevision;
  function renderRoutes() {
    $('voice-routes').innerHTML = (data.preferences?.routes || [])
      .map((route, i) => {
        const source = data.locations.find((p) => p.id === route.source);
        const target = data.locations.find((p) => p.id === route.destination);
        if (!source || !target) return '';
        const label = `${source.name} → ${target.name}`;
        return `<span class="saved-route"><button type="button" data-route="${i}">${escape(label)}</button><button type="button" data-remove-route="${i}" aria-label="${escape(label)} entfernen" title="Richtung entfernen">×</button></span>`;
      })
      .join('');
  }
  async function saveRoutes(routes) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await request('/inventory/actions', {
        type: 'preferences',
        revision: voiceRevision,
        preferences: { routes },
      });
      data.preferences = { ...data.preferences, routes };
      data.revision = result.revision;
      voiceRevision = result.revision;
      undoAction = undefined;
      $('undo-action').hidden = true;
      renderRoutes();
      $('voice-error').textContent = 'Ortsrichtungen gespeichert.';
    } catch (error) {
      $('voice-error').textContent = error.message;
    } finally {
      setBusy(false);
      validateVoice();
    }
  }
  const voiceAvailable = () =>
    data.garments.filter((g) =>
      g.bins.some(
        (b) =>
          b.location === $('voice-source').value &&
          b.status === 'available' &&
          b.quantity > 0,
      ),
    );
  function validateVoice() {
    const totals = new Map();
    let valid =
      voiceRows.length > 0 &&
      $('voice-source').value !== $('voice-target').value;
    voiceRows.forEach((row, index) => {
      const garment = voiceAvailable().find(
        (g) => String(g.id) === String(row.garmentId),
      );
      const maximum =
        garment?.bins
          .filter(
            (b) =>
              b.location === $('voice-source').value &&
              b.status === 'available',
          )
          .reduce((n, b) => n + b.quantity, 0) || 0;
      const total = (totals.get(String(row.garmentId)) || 0) + row.quantity;
      totals.set(String(row.garmentId), total);
      const error = !garment
        ? 'Bitte Artikel wählen oder Zeile entfernen.'
        : !Number.isSafeInteger(row.quantity) || row.quantity < 1
          ? 'Mindestens ein ganzes Stück wählen.'
          : total > maximum
            ? `Nur ${maximum} verfügbar (inklusive weiterer Zeilen).`
            : '';
      $('voice-row-error-' + index).textContent = error;
      if (error) valid = false;
    });
    $('voice-confirm').disabled = !valid || busy;
    $('voice-error').textContent =
      $('voice-source').value === $('voice-target').value
        ? 'Bitte unterschiedliche Orte wählen.'
        : '';
    return valid;
  }
  function renderVoice() {
    $('voice-results').innerHTML = voiceRows
      .map((row, index) => {
        const candidates = row.candidates.length
          ? row.candidates
          : voiceAvailable();
        return `<div class="voice-row"><label>${escape(row.query)}<select data-voice-item="${index}" aria-label="Artikel für ${escape(row.query)}"><option value="">${row.candidates.length ? 'Artikel auswählen …' : 'Kein Treffer – manuell wählen …'}</option>${candidates.map((g) => `<option value="${escape(g.id)}" ${String(row.garmentId) === String(g.id) ? 'selected' : ''}>${escape(g.name || g.category)}</option>`).join('')}</select></label><label>Menge<input data-voice-quantity="${index}" type="number" min="1" step="1" value="${escape(row.quantity)}"></label><button type="button" data-voice-remove="${index}" aria-label="${escape(row.query)} entfernen" title="Entfernen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg></button><small id="voice-row-error-${index}"></small></div>`;
      })
      .join('');
    validateVoice();
  }
  $('open-voice').addEventListener('click', () => {
    if (!data || busy) return;
    $('voice-source').innerHTML = options(data.locations);
    $('voice-target').innerHTML = options(data.locations);
    const source =
      $('inventory-location').value ||
      localStorage.getItem('closet-voice-source');
    if (data.locations.some((place) => place.id === source))
      $('voice-source').value = source;
    const target = $('move-destination').value;
    $('voice-target').value =
      target !== $('voice-source').value
        ? target
        : data.locations.find((p) => p.id !== $('voice-source').value)?.id ||
          '';
    voiceRevision = data.revision;
    voiceRows = [];
    $('voice-text').value = '';
    renderVoice();
    renderRoutes();
    $('voice-dialog').showModal();
  });
  $('close-voice').addEventListener('click', () => $('voice-dialog').close());
  const invalidateVoice = () => {
    voiceRows = [];
    renderVoice();
  };
  $('voice-source').addEventListener('change', invalidateVoice);
  $('voice-text').addEventListener('input', invalidateVoice);
  $('voice-target').addEventListener('change', validateVoice);
  $('voice-swap').addEventListener('click', () => {
    const source = $('voice-source').value;
    $('voice-source').value = $('voice-target').value;
    $('voice-target').value = source;
    invalidateVoice();
  });
  $('voice-save-route').addEventListener('click', () => {
    const source = $('voice-source').value;
    const destination = $('voice-target').value;
    if (source === destination) {
      validateVoice();
      return;
    }
    const routes = data.preferences?.routes || [];
    if (
      !routes.some(
        (route) => route.source === source && route.destination === destination,
      )
    )
      saveRoutes([...routes, { source, destination }]);
  });
  $('voice-routes').addEventListener('click', (event) => {
    const use = event.target.closest('[data-route]');
    const remove = event.target.closest('[data-remove-route]');
    const routes = data.preferences?.routes || [];
    if (use) {
      const route = routes[Number(use.dataset.route)];
      $('voice-source').value = route.source;
      $('voice-target').value = route.destination;
      invalidateVoice();
    }
    if (remove)
      saveRoutes(
        routes.filter((_, i) => i !== Number(remove.dataset.removeRoute)),
      );
  });
  $('voice-match').addEventListener('click', () => {
    voiceRows = window.ClosetVoice.parse(
      $('voice-text').value,
      data.garments,
      $('voice-source').value,
    );
    renderVoice();
    if (!voiceRows.length)
      $('voice-error').textContent =
        'Bitte zuerst Artikel diktieren oder eingeben.';
  });
  $('voice-results').addEventListener('input', (event) => {
    if (event.target.dataset.voiceQuantity !== undefined)
      voiceRows[Number(event.target.dataset.voiceQuantity)].quantity = Number(
        event.target.value,
      );
    if (event.target.dataset.voiceItem !== undefined)
      voiceRows[Number(event.target.dataset.voiceItem)].garmentId =
        event.target.value;
    validateVoice();
  });
  $('voice-results').addEventListener('click', (event) => {
    const button = event.target.closest('[data-voice-remove]');
    if (!button) return;
    voiceRows.splice(Number(button.dataset.voiceRemove), 1);
    renderVoice();
  });
  $('voice-confirm').addEventListener('click', async () => {
    if (busy || !validateVoice()) return;
    const entries = new Map();
    for (const row of voiceRows) {
      const garment = data.garments.find(
        (g) => String(g.id) === String(row.garmentId),
      );
      const entry = entries.get(garment.id) || {
        garmentId: garment.id,
        location: $('voice-source').value,
        status: 'available',
        quantity: 0,
      };
      entry.quantity += row.quantity;
      entries.set(garment.id, entry);
    }
    const destination = $('voice-target').value;
    const source = $('voice-source').value;
    $('voice-confirm').disabled = true;
    if (
      await change({
        type: 'transfer',
        entries: [...entries.values()],
        destination,
        revision: voiceRevision,
      })
    ) {
      localStorage.setItem('closet-last-destination', destination);
      localStorage.setItem('closet-voice-source', source);
      $('voice-dialog').close();
    } else {
      validateVoice();
      $('voice-error').textContent = $('inventory-message').textContent;
    }
  });
  $('backup-import').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const file = $('backup-file').files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      message('Die Sicherung ist größer als 100 MB.', true);
      return;
    }
    const form = new FormData();
    form.append('backup', file);
    setBusy(true);
    try {
      const response = await fetch('/inventory/backup', {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Inventory-Request': '1' },
        body: form,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || 'Import fehlgeschlagen.');
      undoAction = undefined;
      $('undo-action').hidden = true;
      await load();
      $('backup-import').reset();
      message(`${result.imported} Artikel importiert.`);
    } catch (error) {
      message(error.message, true);
    } finally {
      setBusy(false);
    }
  });
  $('refresh-inventory').addEventListener('click', refresh);
  $('close-stock').addEventListener('click', () => $('stock-dialog').close());
  $('stock-inputs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-step]');
    if (!button) return;
    const input = button.parentElement.querySelector('input');
    input.value = String(Number(input.value) + Number(button.dataset.step));
    updateStockControls();
  });
  $('stock-inputs').addEventListener('input', (event) => {
    const input = event.target;
    if (input.value !== '') {
      input.value = String(
        Math.max(
          0,
          Math.min(Number(input.max), Math.trunc(Number(input.value))),
        ),
      );
    }
    updateStockControls();
  });
  $('stock-correction').addEventListener('change', () => {
    const inputs = stockInputs();
    if (
      !$('stock-correction').checked &&
      inputs.reduce((count, input) => count + Number(input.value), 0) >
        editTotal
    ) {
      inputs.forEach((input) => {
        input.value = input.defaultValue;
      });
    }
    updateStockControls();
  });
  $('stock-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const bins = stockInputs()
      .map((input) => ({
        location: input.dataset.place,
        status: input.dataset.status,
        quantity: Number(input.value),
      }))
      .filter((bin) => bin.quantity > 0);
    if (
      await change({
        type: $('stock-correction').checked ? 'stock' : 'redistribute',
        garmentId: editId,
        bins,
        revision: editRevision,
      })
    )
      $('stock-dialog').close();
  });
  $('place-list').addEventListener('submit', async (event) => {
    event.preventDefault();
    await change({
      type: 'location',
      locationId: event.target.dataset.place,
      name: new FormData(event.target).get('name'),
    });
  });
  $('add-place').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (
      await change({
        type: 'location',
        name: new FormData(event.target).get('name'),
      })
    )
      event.target.reset();
  });
  // Refresh idle views, keeping selections and open editors stable. Stale
  // submissions are checked server-side against the captured revision.
  setInterval(() => {
    if (
      !document.hidden &&
      !busy &&
      !selected.size &&
      !$('stock-dialog').open &&
      !$('garment-menu').open &&
      !$('move-preview').open &&
      !$('voice-dialog').open &&
      tab !== 'places' &&
      !document.activeElement.matches('input,select')
    )
      refresh();
  }, 30000);
  (async () => {
    await refresh();
    const id = Number(new URLSearchParams(location.search).get('item'));
    if (id && data) openStock(id);
  })();
})();
