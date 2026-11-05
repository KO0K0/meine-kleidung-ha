# Meine Kleidung – Testversion 0.1

Persönliche Erweiterung von Libre Closet 0.6.0 mit Wohnorten, Gepäck, Mengen und Wäscheverwaltung. Grundlage ist Commit `08f66dd9fe071e3b62e529d0ca4050169d31532d`.

## Auf Windows starten

1. Den Ordner `Meine-Kleidung-Windows` öffnen.
2. `Starten.cmd` doppelt anklicken. Die benötigte Laufzeit ist enthalten.
3. Der Browser öffnet die App. Das Startfenster während der Nutzung offen lassen.
4. Zum Beenden im Startfenster **Strg+C** drücken.

Die lokale Adresse lautet normalerweise `http://127.0.0.1:3088/inventory`. Fotos und Mengen bleiben im Unterordner `Meine-Daten` nach einem Neustart erhalten. Zum Sichern die App beenden und den gesamten Ordner `Meine-Daten` kopieren. Bei Updates diesen Ordner behalten.

## Ausprobieren

- **Artikel hinzufügen** öffnet das vorhandene Formular von Libre Closet. Angaben eingeben und speichern.
- In der Übersicht auf das Kleidungsbild tippen. Das Menü öffnet **Mengen & Orte** oder **Details & Foto**.
- Auf der Detailseite ein Foto auswählen. Bei eingeschalteter Hintergrundentfernung erscheint anschließend die Vorschau zum Nachbearbeiten. Ergebnis übernehmen und **Foto hinzufügen** drücken.
- **Ort und Menge verwalten** öffnet die Verteilung. Neue und bisherige Artikel beginnen mit einem verfügbaren Exemplar unter **Noch zuordnen**.
- Zum Verteilen mit **−** Stücke von einem Ort abziehen und mit **+** einem Ort oder der Wäsche zuweisen. Speichern ist möglich, sobald alle Stücke zugewiesen sind.
- Bei vier gleichen Paar Socken **Gesamtzahl korrigieren** aktivieren, die ursprüngliche 1 auf 0 setzen und am gewünschten Wohnort 4 eintragen.
- Die Waschmaschinentaste auf der Kachel legt ein Stück am selben Ort in die Wäsche. Der Rückholpfeil macht alle Stücke dieses Artikels in der Wäsche am selben Ort wieder verfügbar.
- Markierte Zeilen bleiben beim Suchen und Filtern ausgewählt. Beim Scrollen kannst du die Suche über die Lupe öffnen oder mit dem Pfeil nach oben springen.
- Für eine Sammelaktion die Kästchen aktivieren, bei Bedarf die eingeblendete Teilmenge einstellen und **In die Wäsche** oder **Verschieben** auswählen.
- Beim Ankreuzen ist ein Stück vorausgewählt. Die Verschiebevorschau zeigt alle ausgewählten Stücke mit ihren Ausgangsorten. Nach der Bestätigung merkt sich der Browser den Zielort.
- **Rückgängig** nimmt die letzte Wäsche- oder Verschiebeaktion zurück, solange der Bestand seitdem nicht anderweitig geändert wurde.
- Unter **Sicherung & Import** kannst du Artikel, Orte, Mengen und Fotos als JSON-Datei herunterladen und in einen leeren Bestand importieren. Die Dateigrenze beträgt 100 MB.
- Im Tab **Wäsche** mehrere Bestände auswählen und gemeinsam **Wieder verfügbar** markieren.
- Unter **Orte** die Wohnungsnamen ändern. Der Tab **Gepäck** behält seine Zuordnung auch nach Umbenennung des Gepäckorts.

Die Suche durchsucht Name, Marke, Größe, Farbe, Kategorie und Notizen. Ort, Kategorie und Status lassen sich zusätzlich filtern. Im Leerlauf aktualisiert sich die Übersicht alle 30 Sekunden. Bei einer Auswahl bleibt sie stabil. Verändert ein anderes Gerät inzwischen den Bestand, wird eine veraltete Änderung zurückgewiesen. Dann **Aktualisieren** drücken und erneut auswählen.

## Stand der Zwischenversion

### Sprachliste

Das gesamte Kleidungsinventar verwendet jetzt ein dunkles Design mit hellen Beschriftungen und klaren Eingabefeldern. Die Farbauswahl zeigt deutsche Namen. Mit der Mülltonne entfernst du Vorgaben oder eigene Farben aus der Liste. Bereits gespeicherte Farbangaben bleiben erhalten. „Entfernte Farben wieder anzeigen“ stellt die Liste wieder her. Eigene Farben stehen auch bei weiteren Artikeln zur Auswahl bereit.

Mit **Richtung merken** speicherst du ein Start-/Zielort-Paar in der Sprachliste. Tippe später auf die gespeicherte Richtung, um beide Orte einzusetzen. **⇄** kehrt die aktuelle Richtung um. Über **×** entfernst du eine gespeicherte Richtung. Farben und Ortsrichtungen liegen in der Datenbank und sind in neuen Sicherungen enthalten. Beim späteren Betrieb auf Home Assistant stehen sie damit auch auf deinen anderen Geräten zur Verfügung.

Die Zuordnung berücksichtigt jetzt auch einfache Pluralformen, Bindestriche und kleine Schreibfehler. Eindeutige Namen und Pluralformen werden vorausgewählt. Ähnliche Namen nach einem Schreibfehler musst du ausdrücklich auswählen. Beispielsweise passt „Zip-Hoodies“ zu „Zip-Hoodie“, während „Zip-Hoddie“ einen Vorschlag zur Prüfung liefert.

Über das Mikrofon oben öffnest du die Sprachliste. Wähle Start- und Zielort, tippe ins Textfeld und diktiere über das Mikrofon der iPhone-Tastatur oder unter Windows mit **Windows-Taste + H**. Du kannst die Liste auch schreiben. Beispielsweise **zwei Zip-Hoodies, ein schwarzes T-Shirt, Strümpfe**. Sprich zwischen Artikeln „Komma“.

**Artikel zuordnen** sucht Namen und Namensteile unter den verfügbaren Artikeln am Startort. Ohne Zahl gilt ein Stück. Bei mehreren Treffern wählst du selbst, unbekannte Namen kannst du manuell zuordnen. Prüfe die Liste, ändere Mengen oder entferne Zeilen mit der Mülltonne. Erst **Jetzt verschieben** verändert den Bestand. Doppelte Nennungen werden zusammengerechnet und dürfen den verfügbaren Bestand nicht überschreiten. **Rückgängig** funktioniert auch hier.

Diese erste Version verwendet die Diktierfunktion des Geräts, keine eigene Mikrofonaufnahme oder lokale Spracherkennungs-KI. Die Zuordnung des Texts zu deinen Artikeln erfolgt im Browser. Nachträgliche Änderungen am Text oder Startort leeren die Vorschau, damit du sie neu prüfen kannst.

Die Bestandsverwaltung, Fotoverwaltung und das lokale Freistellen sind in der Testversion enthalten. Angaben zum Kleidungsstück lassen sich im Formular bearbeiten.

Die neue Bestandsansicht ist deutsch. Die übrige Oberfläche richtet sich nach der Browsersprache. Online-Zugriff von iPhone, Mac und PC folgt mit dem Betrieb auf Home Assistant. Die Windows-Version verwendet die lokale Adresse des PCs.

Das HA-Paket ist vorbereitet. Ein tatsächlicher Container-Build und die Installation auf deinem HA-PC stehen noch aus. Sichere vor dem Wechsel den Bestand in der Windows-App und importiere die Datei in das frisch angelegte HA-Konto.

## Home Assistant OS

Im Quellcodepaket ist `meine_kleidung` eine lokale Home-Assistant-App.

1. Den vollständigen Ordner nach `/addons/meine_kleidung` auf dem HA-PC kopieren, beispielsweise über Samba.
2. Den App-/Add-on-Store neu laden und unter den lokalen Apps **Meine Kleidung** installieren. Der erste Build lädt Software und Modelle herunter und kann auf langsamer Hardware länger dauern.
3. Starten und **Weboberfläche öffnen** wählen. Standardmäßig wird Port 3088 verwendet.
4. Zunächst im Heimnetz ein Konto registrieren. Anschließend in der App-Konfiguration `allow_registration` auf `false` setzen und neu starten.
5. Die Kleidungs-Subdomain im Cloudflare-Tunnel auf den HA-PC und Port 3088 richten. Der App-Login ist im HA-Paket aktiviert. Die Einrichtung des Tunnels erfolgt gesondert.

Fotos und Datenbank liegen dauerhaft unter `/data`. Das Paket verwendet eine eigene Webadresse und den Login von Libre Closet. Ingress ist noch nicht eingerichtet.

## Quellcode und Lizenz

Der geänderte Quellcode liegt im Begleitpaket `Meine-Kleidung-HomeAssistant-Quellcode.zip`. Libre Closet und diese Änderungen stehen unter AGPL-3.0, siehe `LICENSE`. Bibliotheken und Node enthalten ihre eigenen Lizenzdateien. Konfigurationsdateien mit Schlüsseln und lokale Daten sind aus dem Quellcodepaket ausgeschlossen. Die Startprogramme erzeugen benötigte Schlüssel lokal.

Ursprüngliches Projekt https://github.com/Lazztech/Libre-Closet

Entwicklung mit Node 22 erfolgt über `npm ci`, `npm run build` und `npm run start:prod`. Die neue Ansicht liegt unter `/inventory`. Die Anwendungstypen prüft `node node_modules/typescript/bin/tsc -p tsconfig.build.json --noEmit`. Modultests laufen mit `npm test -- --runInBand`.
