# Installation und Betrieb

1. In der Windows-App unter **Sicherung & Import** eine Sicherung herunterladen.
2. In Home Assistant unter **Einstellungen → Apps → App installieren → Repositories** diese Quelle hinzufügen: `https://github.com/KO0K0/meine-kleidung-ha#ha-store`.
3. **Meine Kleidung** installieren. Voraussetzung ist Home Assistant OS auf einem Intel-/AMD-PC (amd64).
4. Unter Konfiguration `site_url` auf die spätere Adresse setzen, beispielsweise `https://kleidung.example.org`. Für einen lokalen Test die tatsächliche Adresse des HA-PCs mit Port 3088 verwenden. Keine Unterpfade angeben.
5. App starten und über **Weboberfläche öffnen** aufrufen. Ein eigenes Konto registrieren.
6. Anschließend `allow_registration` auf `false` stellen, speichern und die App neu starten. Bestehende Konten funktionieren weiterhin.
7. Im leeren Konto die Windows-Sicherung importieren. Prüfen, ob Artikel, Mengen, Fotos und Orte vollständig sind.
8. Erst danach die Kleidungs-Subdomain im Cloudflare-Tunnel auf `http://<HA-IP>:3088` richten. Die App-Anmeldung bleibt aktiv. Die vorhandene HA-Tunnelroute bleibt unverändert.

## Einstellungen

- `allow_registration`: erlaubt das Anlegen neuer Konten. Nur zur Einrichtung einschalten.
- `site_url`: vollständige Webadresse ohne Unterpfad, etwa `https://kleidung.example.org`.
- Netzwerk: intern Port 3000, nach außen standardmäßig 3088. Bei Konflikten den äußeren Port in HA ändern.

## Sicherung und Updates

Fotos, SQLite-Datenbank und der Anmeldeschlüssel liegen unter `/data`. Die App fordert kalte Backups an, damit die Datenbank während der HA-Sicherung angehalten wird. Die JSON-Sicherung innerhalb der App ist zusätzlich für einen Umzug geeignet.

Neue geprüfte Versionen erscheinen in Home Assistant als Update. Vor dem Aktualisieren eine HA-Sicherung einschließlich dieser App erstellen. Nicht deinstallieren, um ein Update einzuspielen. Für einen Rückweg die vollständige Sicherung wiederherstellen, insbesondere nach Datenbankänderungen.

Die eigene Webadresse funktioniert auf iPhone, PC und Mac. Einbettung in die HA-Seitenleiste (Ingress) ist in dieser Version nicht enthalten. Es gibt keine kostenpflichtige Pflicht-KI. Die Sprachliste nutzt die Diktierfunktion deines Geräts.

## Fehler eingrenzen

- Quelle nicht gefunden: den kompletten Link einschließlich `#ha-store` verwenden. Der Zweig existiert erst nach einem erfolgreichen Release-Workflow.
- Download verweigert: das GitHub-Containerpaket muss öffentlich sein.
- Startfehler: App-Protokoll in Home Assistant prüfen. Keine Schlüssel oder Datenbanksicherungen öffentlich posten.
- Registrierung nicht möglich: zum Anlegen des ersten Kontos `allow_registration` einschalten und neu starten.


## Etikett-Scan (ab 0.3.0)

Im Formular „Etikett scannen“ aufklappen, bis zu vier Etikettfotos auswählen oder aufnehmen und „Text erkennen“ drücken. Bei Bedarf Fotos vorher drehen. Die Texterkennung läuft auf dem aktuellen Handy oder Computer; Fotos werden weder an OCR-Dienste gesendet noch als Etikettbilder gespeichert. Sprachmodelle werden von der eigenen App geladen und können im Browser zwischengespeichert werden.

Erkannten Text kannst du korrigieren und über „Vorschläge ermitteln“ erneut auswerten. Die gewünschte Größe auswählen und die Angaben ausdrücklich übernehmen. Bestehende Feldwerte sind nicht vorausgewählt. Anschließend das Kleidungsstück speichern. Halbe und Viertelgrößen wie 15½, 15¾ oder 15 1/4 bleiben erhalten; die App rechnet keine Größensysteme um. Gedruckte Pflegehinweise können übernommen werden; Waschzeichen und eine visuelle Erkennung des Kleidungsstücktyps sind nicht Bestandteil des Scans.

Material und Artikelnummer werden mit gesichert. Sicherungen älterer Versionen bleiben einlesbar; Sicherungen mit den neuen Feldern benötigen Version 0.3.0 oder neuer.


## Viele Kleidungsstücke erfassen (ab 0.4.0)

Am Ende der Übersicht „Schrank erfassen“ aufklappen und die Erfassung starten. Kategorie (etwa Pullover) und Ort einmal festlegen. Anschließend pro Artikel Foto und optional Etikett auswählen, im nächsten Schritt Angaben prüfen und „Speichern & nächster“ drücken. Fotos sind optional. Die Menge beginnt für jeden Artikel bei 1; nur identische Exemplare als höhere Menge zusammenfassen.

Kategorie und Ort bleiben in dieser Browsersitzung erhalten. Weitere Angaben wie Pflege, Material und Artikelnummer können im Prüfschritt aufgeklappt werden. Für den nächsten Kleidungsstapel oben „Kategorie / Ort ändern“ wählen. Mit „Speichern & beenden“ wird der letzte Artikel gespeichert und die Übersicht geöffnet. Individuelle Entwürfe/Fotos werden nicht über ein Neuladen der Seite hinweg gespeichert. Bei ungespeicherten Eingaben erscheint eine Warnung vor dem Verlassen.


## Oberfläche ab 0.5.0

Das Dreipunktmenü oben enthält Schrank-Erfassung, Sicherung/Import und das Konto. Am Handy liegt die Hauptnavigation unten; Filter lassen sich ausklappen. Ein Klick auf ein Kleidungsbild öffnet das Artikelpanel mit „Mengen & Orte“ und „Details & Foto“. Die Bearbeitung von Angaben und Fotos ist von dort erreichbar. Suche und Auswahl bleiben bei der Rückkehr erhalten.

Animationen berücksichtigen die Systemeinstellung für reduzierte Bewegung. Die Anwendung verwendet weiterhin ihre vorhandene Datenbank; das Designupdate benötigt keinen Datenimport.
