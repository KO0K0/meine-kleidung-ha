(() => {
  const $ = id => document.getElementById(id);
  window.ClosetAssistant = {
    init({ change, getData }) {
      let turns = [], pending, activeProvider, running = false;
      const dialog = $('assistant-dialog');
      const clear = () => { turns = []; pending = undefined; $('assistant-history').replaceChildren(); $('assistant-result').replaceChildren(); $('assistant-confirm').hidden = true; };
      const say = (label, text) => {
        const item = document.createElement('p'); const title = document.createElement('strong'); title.textContent = label + ' '; item.append(title, document.createTextNode(text)); $('assistant-history').append(item);
      };
      $('open-assistant').addEventListener('click', async () => {
        $('closet-tools').hidePopover?.();
        dialog.showModal();
        try {
          const response = await fetch('/inventory/assistant/providers', { cache: 'no-store' });
          if (!response.ok) throw Error('Bitte anmelden und erneut öffnen.');
          const providers = await response.json();
          const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = providers.some(p => p.configured) ? 'Anbieter auswählen' : 'Noch kein Anbieter eingerichtet';
          $('assistant-provider').replaceChildren(placeholder, ...providers.map(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.label + (p.configured ? '' : ' · Schlüssel fehlt'); o.disabled = !p.configured; return o; }));
          if (providers.some(p => p.id === activeProvider && p.configured)) $('assistant-provider').value = activeProvider;
          else $('assistant-provider').value = providers.find(p => p.configured)?.id || '';
          $('assistant-status').textContent = providers.some(p => p.configured) ? 'Bereit. Gesendet werden dein Text sowie Namen, Eigenschaften, Orte und Mengen deiner Kleidung.' : 'Trage zuerst einen eigenen API-Schlüssel in der Konfiguration dieser HA-App ein. Danach die App neu starten. Die bisherige Sprachliste funktioniert weiterhin.';
        } catch (e) { $('assistant-status').textContent = e.message; }
      });
      $('assistant-close').addEventListener('click', () => dialog.close());
      $('assistant-new').addEventListener('click', () => { clear(); $('assistant-status').textContent = 'Neues Gespräch.'; });
      $('assistant-provider').addEventListener('change', () => { clear(); $('assistant-status').textContent = 'Anbieter gewechselt. Neuer Vergleich mit einem leeren Gespräch.'; });
      $('assistant-form').addEventListener('submit', async event => {
        event.preventDefault(); if (running) return;
        const text = $('assistant-text').value.trim(), provider = $('assistant-provider').value;
        if (!text || !provider) { $('assistant-status').textContent = 'Bitte Anbieter und Auftrag angeben.'; return; }
        if (turns.length >= 10) { $('assistant-status').textContent = 'Bitte ein neues Gespräch beginnen.'; return; }
        activeProvider = provider; pending = undefined; $('assistant-confirm').hidden = true; $('assistant-result').replaceChildren();
        const messages = [...turns, { role: 'user', content: text }];
        say('Du:', text); running = true; $('assistant-send').disabled = true; $('assistant-new').disabled = true; $('assistant-provider').disabled = true;
        $('assistant-status').textContent = 'Verstehe deinen Auftrag …'; const start = performance.now();
        try {
          const response = await fetch('/inventory/assistant/understand', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Inventory-Request': '1' }, body: JSON.stringify({ provider, turns: messages }) });
          const result = await response.json(); if (!response.ok) throw Error(result.message || 'Anfrage fehlgeschlagen.');
          turns = [...messages, { role: 'assistant', content: result.interpretation }]; $('assistant-text').value = '';
          $('assistant-status').textContent = result.model + ' · ' + ((performance.now() - start) / 1000).toFixed(1) + ' s';
          if (result.kind === 'question') say('Assistent:', result.question);
          else if (result.kind === 'query') {
            say('Assistent:', result.garments.length ? 'Diese Artikel passen:' : 'Keine passenden Artikel gefunden.');
            for (const garment of result.garments) {
              const row = document.createElement('p'); row.textContent = (garment.name || garment.category) + ': ' + (garment.bins.map(bin => `${bin.quantity} × ${getData().locations.find(p => p.id === bin.location)?.name || bin.location} · ${bin.status === 'laundry' ? 'Wäsche' : 'verfügbar'}`).join('; ') || 'Kein Bestand in diesem Bereich'); $('assistant-result').append(row);
            }
          } else {
            pending = result.action; say('Assistent:', 'Bitte prüfe den vorbereiteten Auftrag. Du kannst ihn auch mit einer weiteren Nachricht korrigieren.');
            const data = getData();
            for (const entry of pending.entries) {
              const row = document.createElement('p');
              row.textContent = `${entry.quantity} × ${data.garments.find(g => g.id === entry.garmentId)?.name || data.garments.find(g => g.id === entry.garmentId)?.category} · ${data.locations.find(p => p.id === entry.location)?.name} (${entry.status === 'laundry' ? 'Wäsche' : 'verfügbar'}) → ${data.locations.find(p => p.id === (pending.destination || entry.location))?.name} (${(pending.status || entry.status) === 'laundry' ? 'Wäsche' : 'verfügbar'})`;
              $('assistant-result').append(row);
            }
            $('assistant-confirm').hidden = false;
          }
        } catch (e) { $('assistant-status').textContent = e.message; }
        finally { running = false; $('assistant-send').disabled = false; $('assistant-new').disabled = false; $('assistant-provider').disabled = false; }
      });
      $('assistant-confirm').addEventListener('click', async () => {
        if (!pending || running) return;
        const action = pending; pending = undefined; $('assistant-confirm').hidden = true;
        running = true; $('assistant-send').disabled = true;
        try {
          if (await change(action)) { clear(); say('Assistent:', 'Auftrag ausgeführt. Was möchtest du als Nächstes tun?'); $('assistant-status').textContent = 'Gespeichert. Rückgängig ist in der Übersicht verfügbar.'; }
          else { turns = []; $('assistant-result').replaceChildren(); $('assistant-status').textContent = 'Nicht gespeichert. Der Bestand könnte sich geändert haben. Bitte den Auftrag erneut prüfen lassen.'; }
        } finally { running = false; $('assistant-send').disabled = false; }
      });
    },
  };
})();
