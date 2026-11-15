import { parseLabel } from './label-rules.mjs';

const panel = document.querySelector('[data-label-scanner]');
if (panel) {
  const form = panel.closest('form');
  const $ = selector => panel.querySelector(selector);
  const files = $('#label-files');
  const capture = $('[data-label-capture]');
  const previews = $('[data-label-previews]');
  const recognize = $('[data-label-recognize]');
  const cancel = $('[data-label-cancel]');
  const status = $('[data-label-status]');
  const text = $('#label-text');
  const results = $('[data-label-suggestions]');
  const apply = $('[data-label-apply]');
  const submit = form.querySelector('button[type="submit"]');
  const fieldNames = { brand: 'Marke', size: 'Größe', material: 'Material', articleNumber: 'Artikelnummer', washingDetails: 'Pflegehinweise' };
  let knownBrands = [];
  try { knownBrands = JSON.parse(panel.dataset.knownBrands || '[]') || []; } catch {}
  const images = [];
  let active = null;
  let lowConfidence = false;
  let suggestionInputs = [];
  const updateBusy = () => {
    const busy = !!active;
    form.dataset.labelScanBusy = String(busy);
    form.dispatchEvent(new Event('label-scan-busy'));
    submit.disabled = busy || form.dataset.photoBusy === 'true';
    files.disabled = capture.disabled = $('[data-label-camera]').disabled = busy;
    recognize.disabled = busy || !images.length || form.dataset.photoBusy === 'true';
    $('[data-label-parse]').disabled = text.disabled = apply.disabled = busy;
    cancel.hidden = !busy;
    for (const control of previews.querySelectorAll('button')) control.disabled = busy;
  };
  form.addEventListener('garment-photo-busy', updateBusy);
  // Edit/clone forms submit normally; never submit while OCR is running.
  form.addEventListener('submit', event => {
    if (active) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  const element = (tag, content, className) => {
    const node = document.createElement(tag);
    if (content) node.textContent = content;
    if (className) node.className = className;
    return node;
  };
  const renderImages = () => {
    previews.replaceChildren();
    images.forEach((entry, index) => {
      const figure = element('figure');
      const img = element('img'); img.src = entry.url; img.alt = `Etikett ${index + 1}`;
      img.style.transform = `rotate(${entry.rotation}deg)`;
      figure.append(img);
      const actions = element('figcaption', '', 'label-actions');
      const rotate = element('button', '↻', 'btn btn-ghost btn-sm');
      rotate.type = 'button'; rotate.setAttribute('aria-label', `Etikett ${index + 1} um 90 Grad drehen`); rotate.title = 'Drehen';
      rotate.addEventListener('click', () => { entry.rotation = (entry.rotation + 90) % 360; renderImages(); });
      const remove = element('button', '', 'btn btn-ghost btn-sm');
      remove.type = 'button'; remove.setAttribute('aria-label', `Etikett ${index + 1} entfernen`); remove.title = 'Etikett entfernen';
      // Constant icon markup only; recognized text is always written via textContent.
      remove.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 10v8m4-8v8"/></svg>';
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(entry.url); images.splice(index, 1); renderImages();
        status.textContent = 'Foto entfernt. Bereits erkannter Text bleibt zur Bearbeitung erhalten.';
      });
      actions.append(element('span', `Etikett ${index + 1}`), rotate, remove);
      figure.append(actions); previews.append(figure);
    });
    updateBusy();
  };
  const addFiles = list => {
    if (active || form.dataset.photoBusy === 'true') return;
    let rejected = false;
    for (const file of list) {
      if (images.length >= 4 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) { rejected = true; continue; }
      images.push({ file, rotation: 0, url: URL.createObjectURL(file) });
    }
    renderImages();
    status.textContent = rejected ? 'Maximal vier Etikettfotos als JPEG, PNG oder WebP mit jeweils bis zu 20 MB. Gültige Fotos wurden hinzugefügt.' : 'Fotos bereit. Bei Bedarf drehen, dann „Text erkennen“ drücken.';
  };
  files.addEventListener('change', () => { addFiles(files.files); files.value = ''; });
  $('[data-label-camera]').addEventListener('click', () => capture.click());
  capture.addEventListener('change', () => { addFiles(capture.files); capture.value = ''; });

  const parse = () => {
    const suggestions = parseLabel(text.value, { category: form.elements.namedItem('category')?.value || '', knownBrands });
    results.replaceChildren(); suggestionInputs = [];
    const grouped = new Map();
    for (const suggestion of suggestions) {
      if (!grouped.has(suggestion.field)) grouped.set(suggestion.field, []);
      grouped.get(suggestion.field).push(suggestion);
    }
    for (const [field, candidates] of grouped) {
      const current = form.elements.namedItem(field)?.value || '';
      const group = element('fieldset'); group.append(element('legend', fieldNames[field]));
      if (current) group.append(element('p', `Aktuell: ${current}. Eine bestätigte Auswahl ersetzt diesen Wert.`, 'label-hint'));
      if (candidates.length > 1) group.append(element('p', 'Mehrere Möglichkeiten gefunden – bitte eine auswählen.', 'label-hint'));
      for (const candidate of candidates) {
        const row = element('label', '', 'label-suggestion');
        const check = element('input'); check.type = 'checkbox';
        check.checked = !current && candidates.length === 1 && !candidate.uncertain && !lowConfidence;
        const value = element('input'); value.type = 'text'; value.value = candidate.value;
        value.maxLength = field === 'articleNumber' || field === 'size' || field === 'brand' ? 255 : 10000;
        value.setAttribute('aria-label', `${fieldNames[field]}-Vorschlag bearbeiten`);
        const description = element('span', '', 'label-suggestion-copy');
        description.append(value, element('small', (lowConfidence ? 'Erkennung unsicher. ' : '') + candidate.reason));
        check.setAttribute('aria-label', `${fieldNames[field]} ${candidate.value} übernehmen`);
        const item = { field, check, value }; suggestionInputs.push(item);
        check.addEventListener('change', () => {
          if (check.checked) for (const other of suggestionInputs) if (other.field === field && other !== item) other.check.checked = false;
        });
        row.append(check, description); group.append(row);
      }
      results.append(group);
    }
    apply.hidden = !suggestions.length;
    if (!suggestions.length) status.textContent = text.value.trim() ? 'Keine eindeutigen Angaben gefunden. Du kannst den Text korrigieren oder die Felder selbst ausfüllen.' : 'Noch kein Etiketttext vorhanden.';
  };
  $('[data-label-parse]').addEventListener('click', parse);
  form.elements.namedItem('category')?.addEventListener('change', () => { if (text.value.trim()) parse(); });
  // Changed text invalidates old suggestions, so stale OCR is never confirmed.
  text.addEventListener('input', () => { results.replaceChildren(); suggestionInputs = []; apply.hidden = true; lowConfidence = false; });
  apply.addEventListener('click', () => {
    let count = 0;
    for (const item of suggestionInputs) {
      if (!item.check.checked || !item.value.value.trim()) continue;
      const target = form.elements.namedItem(item.field);
      if (!target) continue;
      target.value = item.value.value.trim();
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      item.check.checked = false; count++;
    }
    status.textContent = count ? `${count} Angaben ins Formular übernommen. Bitte prüfen und anschließend das Kleidungsstück speichern.` : 'Bitte mindestens einen Vorschlag auswählen.';
    if (count) { results.replaceChildren(); suggestionInputs = []; apply.hidden = true; }
  });

  const prepareImage = async entry => {
    const img = new Image(); img.src = entry.url;
    await img.decode();
    const scale = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    const sideways = entry.rotation % 180 !== 0;
    canvas.width = sideways ? height : width; canvas.height = sideways ? width : height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(entry.rotation * Math.PI / 180);
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
    return canvas;
  };
  const stop = () => {
    const job = active;
    if (!job) return;
    job.canceled = true;
    job.promise?.then(worker => worker.terminate()).catch(() => {});
    active = null; updateBusy();
    status.textContent = 'Erkennung abgebrochen. Vorhandener Text und Formulareingaben bleiben erhalten.';
  };
  cancel.addEventListener('click', stop);
  recognize.addEventListener('click', async () => {
    if (active || !images.length || form.dataset.photoBusy === 'true') return;
    const job = { canceled: false, promise: null, worker: null }; active = job; updateBusy();
    const texts = [];
    let confidenceLow = false;
    try {
      status.textContent = 'Texterkennung wird geladen …';
      const { default: Tesseract } = await import('/ocr/runtime/tesseract.esm.min.js');
      const { createWorker, PSM } = Tesseract;
      if (job.canceled) return;
      job.promise = createWorker(['deu', 'eng'], 1, {
        workerPath: location.origin + '/ocr/runtime/worker.min.js',
        corePath: location.origin + '/ocr/core/',
        langPath: location.origin + '/ocr/lang',
        logger: message => {
          if (active === job) status.textContent = message.status === 'recognizing text' ? `Etikett ${texts.length + 1}/${images.length}: ${Math.round(message.progress * 100)} %` : 'Texterkennung und Sprachdateien werden vorbereitet …';
        },
      });
      const worker = await job.promise; job.worker = worker;
      if (job.canceled) return;
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
      for (const entry of images) {
        const canvas = await prepareImage(entry);
        if (job.canceled) return;
        const { data } = await worker.recognize(canvas);
        canvas.width = canvas.height = 1;
        if (job.canceled) return;
        texts.push(data.text.trim()); confidenceLow ||= data.confidence < 65;
      }
      text.value = texts.filter(Boolean).join('\n\n').slice(0, 12000);
      lowConfidence = confidenceLow;
      parse();
      if (text.value.trim()) status.textContent = 'Text erkannt. Vorschläge mit dem Etikett vergleichen und gewünschte Angaben bestätigen.';
      else status.textContent = 'Kein Text erkannt. Bitte näher, schärfer und ohne Falten fotografieren oder den Text manuell eingeben.';
    } catch (error) {
      if (!job.canceled) console.warn('Lokale Etiketterkennung fehlgeschlagen:', error);
      if (!job.canceled) status.textContent = 'Texterkennung fehlgeschlagen. Fotos und Eingaben bleiben erhalten. Erneut versuchen oder Etiketttext manuell eingeben.';
    } finally {
      if (job.worker) await job.worker.terminate().catch(() => {});
      if (active === job) { active = null; updateBusy(); }
    }
  });
  window.addEventListener('pagehide', () => { stop(); images.forEach(entry => URL.revokeObjectURL(entry.url)); });
}
