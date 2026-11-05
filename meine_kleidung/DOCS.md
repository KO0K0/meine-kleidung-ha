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
