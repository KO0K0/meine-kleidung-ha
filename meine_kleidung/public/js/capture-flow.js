// Reuses the ordinary form, photo processing and label scanner without a second editor.
export async function initCapture(form) {
  const node = (tag, text, className) => {
    const result = document.createElement(tag);
    if (text) result.textContent = text;
    if (className) result.className = className;
    return result;
  };
  const button = (text, className = 'btn btn-outline') => {
    const b = node('button', text, className); b.type = 'button'; return b;
  };
  const key = 'closet-capture-v1';
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(key) || '{}') || {}; } catch {}
  const remember = () => { try { sessionStorage.setItem(key, JSON.stringify(saved)); } catch {} };
  let committed = false;
  let dirty = false;
  const title = document.querySelector('.closet-sheet h1');
  title.textContent = 'Schrank erfassen';
  form.classList.add('capture-form');
  const header = node('div', '', 'capture-header');
  const progress = node('p', '', 'capture-progress'); progress.setAttribute('aria-live', 'polite');
  const session = node('p', '', 'label-hint');
  const change = button('Kategorie / Ort ändern', 'btn btn-ghost btn-sm');
  header.append(progress, session, change); form.before(header);
  const steps = [0, 1, 2].map(index => {
    const section = node('section', '', 'capture-step'); section.dataset.captureStep = String(index); return section;
  });
  const category = form.elements.namedItem('category');
  const categoryGroup = category.closest('.form-control');
  const photo = form.querySelector('.new-garment-photo');
  const scanner = form.querySelector('[data-label-scanner]');
  const save = form.querySelector('button[type="submit"]');
  const originalActions = save.parentElement;
  // All individual details remain editable in the final step.
  const detailGroups = [...form.children].filter(child => child !== photo && child !== scanner && child !== categoryGroup && child !== originalActions && child.id !== 'new-garment-error');
  steps[0].append(node('h2', 'Was liegt vor dir?', 'capture-step-title'), node('p', 'Kategorie und Ort gelten auch für die nächsten Kleidungsstücke.', 'label-hint'), categoryGroup);
  const placeLabel = node('label', 'Ort', 'form-control');
  const place = node('select', '', 'select select-bordered'); place.name = 'initialLocation'; place.required = true; place.setAttribute('aria-label', 'Ort für diese Erfassung'); placeLabel.append(place); steps[0].append(placeLabel);
  steps[1].append(node('h2', 'Foto & Etikett', 'capture-step-title'), photo, scanner);
  steps[2].append(node('h2', 'Angaben prüfen', 'capture-step-title'), ...detailGroups);
  const quantityLabel = node('label', 'Anzahl gleicher Exemplare', 'form-control');
  const quantity = node('input', '', 'input input-bordered'); quantity.name = 'initialQuantity'; quantity.type = 'number'; quantity.min = '1'; quantity.max = '10000'; quantity.step = '1'; quantity.value = '1'; quantity.required = true; quantity.inputMode = 'numeric'; quantityLabel.append(quantity); steps[2].append(quantityLabel);
  const extra = node('details', '', 'capture-extra');
  extra.append(node('summary', 'Weitere Angaben (optional)'));
  for (const group of detailGroups) if (!group.querySelector('[name="name"], [name="brand"], [name="color"], [name="size"]')) extra.append(group);
  steps[2].append(extra);
  const token = node('input'); token.type = 'hidden'; token.name = 'captureToken';
  const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  token.value = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
  const error = form.querySelector('#new-garment-error');
  form.append(...steps, token, error);
  originalActions.remove();
  const actions = node('div', '', 'capture-actions');
  const back = button('Zurück', 'btn btn-ghost');
  const next = button('Weiter', 'btn btn-primary');
  const finish = node('button', 'Speichern & beenden', 'btn btn-outline'); finish.type = 'submit'; finish.dataset.captureFinish = 'true';
  save.textContent = 'Speichern & nächster';
  actions.append(back, next, save, finish); form.append(actions);
  const exit = node('a', 'Erfassung beenden', 'capture-exit'); exit.href = '/inventory'; header.append(exit);
  const completed = Number.isSafeInteger(saved.count) && saved.count > 0 ? saved.count : 0;
  const persistDefaults = () => { saved = { ...saved, category: category.value.trim(), location: place.value, count: completed }; remember(); };
  let step = 0;
  const show = index => {
    step = index;
    steps.forEach((section, i) => { section.hidden = i !== index; });
    back.hidden = index === 0;
    next.hidden = index === 2;
    save.hidden = finish.hidden = index !== 2;
    change.hidden = index === 0;
    progress.textContent = `Schritt ${index + 1} von 3 · ${['Kategorie & Ort', 'Foto & Etikett', 'Angaben prüfen'][index]}`;
    session.textContent = `${completed} Artikel in dieser Erfassung gespeichert${category.value.trim() && place.value ? ` · ${category.value.trim()} · ${place.selectedOptions[0]?.textContent || ''}` : ''}`;
    next.textContent = index === 0 ? 'Erfassung starten' : 'Weiter zu den Angaben';
    // Browser Back traverses unsaved steps, never repeats a save request.
    if (history.state?.captureStep !== index) history.pushState({ captureStep: index }, '', location.href);
    header.scrollIntoView({ behavior: 'instant', block: 'start' });
  };
  const advance = () => {
    if (step === 0) {
      if (!category.reportValidity() || !place.reportValidity()) return;
      persistDefaults();
    }
    show(Math.min(2, step + 1));
  };
  next.addEventListener('click', advance);
  back.addEventListener('click', () => show(Math.max(0, step - 1)));
  change.addEventListener('click', () => show(0));
  window.addEventListener('popstate', event => {
    if (Number.isInteger(event.state?.captureStep)) show(event.state.captureStep);
  });
  form.addEventListener('input', event => { if (event.target !== category && event.target !== place) dirty = true; });
  window.addEventListener('beforeunload', event => { if (dirty && !committed) { event.preventDefault(); event.returnValue = ''; } });
  const syncBusy = () => {
    const busy = form.dataset.photoBusy === 'true' || form.dataset.labelScanBusy === 'true';
    for (const control of [back, next, change, finish]) control.disabled = busy;
  };
  form.addEventListener('garment-photo-busy', syncBusy); form.addEventListener('label-scan-busy', syncBusy);
  next.disabled = true;
  show(0);
  try {
    const response = await fetch('/inventory/data', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Orte nicht verfügbar');
    const data = await response.json();
    for (const location of data.locations) { const option = node('option', location.name); option.value = location.id; place.append(option); }
    if (typeof saved.category === 'string') category.value = saved.category;
    if (data.locations.some(location => location.id === saved.location)) place.value = saved.location;
    else place.value = data.locations.find(location => location.id !== 'unassigned' && location.id !== 'luggage')?.id || data.locations[0].id;
    next.disabled = false;
    show(saved.category && place.value === saved.location ? 1 : 0);
  } catch {
    error.hidden = false; error.textContent = 'Orte konnten nicht geladen werden. Bitte die Seite neu laden oder die normale Artikelerfassung verwenden.';
  }
  return {
    beforeSubmit() {
      if (next.disabled) return false;
      if (step !== 2) { advance(); return false; }
      persistDefaults(); return true;
    },
    saved(destination, finishSession) {
      saved.count = completed + 1; remember(); committed = true;
      if (finishSession) { try { sessionStorage.removeItem(key); } catch {} }
      window.location.replace(finishSession ? '/inventory' : '/wardrobe/new?capture=1');
    },
  };
}
