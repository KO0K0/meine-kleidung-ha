const form = document.getElementById('new-garment-form');
if (form) {
  const input = document.getElementById('new-photo-input');
  const capture = document.getElementById('new-photo-capture');
  const preview = document.getElementById('new-photo-preview');
  const placeholder = document.getElementById('new-photo-placeholder');
  const remove = document.getElementById('new-photo-remove');
  const cutout = document.getElementById('new-photo-cutout');
  const status = document.getElementById('new-photo-status');
  const error = document.getElementById('new-garment-error');
  const save = form.querySelector('button[type="submit"]');
  let photo = null;
  let processed = null;
  let previewUrl = null;
  let busy = false;

  const showPreview = (blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = blob ? URL.createObjectURL(blob) : null;
    if (previewUrl) preview.src = previewUrl;
    else preview.removeAttribute('src');
    preview.hidden = !blob;
    placeholder.hidden = !!blob;
    remove.hidden = !blob;
    cutout.hidden = !blob;
  };
  const setBusy = (value) => {
    busy = value;
    form.dataset.photoBusy = String(value);
    save.disabled = value || form.dataset.labelScanBusy === 'true';
    input.disabled = value;
    capture.disabled = value;
    remove.disabled = value;
    cutout.disabled = value;
    document.getElementById('new-photo-camera').disabled = value;
    form.dispatchEvent(new Event('garment-photo-busy'));
  };
  form.addEventListener('label-scan-busy', () => { save.disabled = busy || form.dataset.labelScanBusy === 'true'; });
  const select = (file) => {
    if (!file || busy) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 20 * 1024 * 1024) {
      input.value = '';
      status.textContent = 'Bitte ein JPEG-, PNG-, WebP- oder GIF-Bild bis 20 MB auswählen.';
      return;
    }
    photo = file;
    processed = null;
    cutout.textContent = 'Hintergrund entfernen';
    showPreview(photo);
    status.textContent = 'Foto ausgewählt. Es wird zusammen mit den Angaben gespeichert.';
  };
  input.addEventListener('change', () => select(input.files?.[0]));
  document.getElementById('new-photo-camera').addEventListener('click', () => capture.click());
  capture.addEventListener('change', () => { select(capture.files?.[0]); capture.value = ''; });
  remove.addEventListener('click', () => {
    photo = processed = null;
    input.value = '';
    showPreview(null);
    status.textContent = 'Kein Foto ausgewählt. Du kannst es später ergänzen.';
  });
  cutout.addEventListener('click', async () => {
    if (!photo || busy) return;
    if (processed) {
      processed = null;
      showPreview(photo);
      cutout.textContent = 'Hintergrund entfernen';
      status.textContent = 'Originalfoto ausgewählt.';
      return;
    }
    setBusy(true);
    status.textContent = 'Hintergrund wird entfernt. Beim ersten Mal werden die Modelldateien geladen …';
    try {
      const { prepareGarmentPhoto } = await import('/js/background-removal.js');
      processed = await prepareGarmentPhoto(photo, (key) => {
        status.textContent = key.startsWith('fetch:') ? 'Modelldateien werden geladen …' : 'Foto wird verarbeitet …';
      });
      if (processed.size > 20 * 1024 * 1024) throw new Error('Processed photo too large');
      showPreview(processed);
      cutout.textContent = 'Original verwenden';
      status.textContent = 'Bearbeitetes Foto bereit. Die Angaben können jetzt gespeichert werden.';
    } catch (cause) {
      processed = null;
      status.textContent = 'Hintergrund konnte nicht entfernt werden. Du kannst das Originalfoto speichern oder es erneut versuchen.';
      console.warn('Fotoverarbeitung fehlgeschlagen', cause);
    } finally {
      setBusy(false);
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || form.dataset.labelScanBusy === 'true') return;
    const data = new FormData(form);
    data.delete('photo');
    if (photo) data.append('photo', photo, photo.name);
    if (processed) data.append('nobgPhoto', processed, 'nobg.png');
    error.hidden = true;
    setBusy(true);
    status.textContent = 'Kleidungsstück wird gespeichert …';
    try {
      const response = await fetch(form.action, { method: 'POST', body: data });
      if (!response.ok) throw new Error(String(response.status));
      const destination = new URL(response.url);
      if (!response.redirected || !/^\/wardrobe\/\d+$/.test(destination.pathname)) {
        throw new Error('Unexpected response');
      }
      window.location.assign(destination.href);
    } catch (cause) {
      error.textContent = 'Speichern konnte nicht bestätigt werden. Deine Eingaben bleiben hier erhalten. Prüfe bei unterbrochener Verbindung zuerst den Bestand, bevor du es erneut versuchst.';
      error.hidden = false;
      status.textContent = photo ? 'Das ausgewählte Foto bleibt erhalten.' : 'Die Angaben bleiben erhalten.';
      setBusy(false);
    }
  });
  window.addEventListener('pagehide', () => { if (previewUrl) URL.revokeObjectURL(previewUrl); });
}
