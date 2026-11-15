# Änderungen

## 0.6.0

- Optionaler Kleidungsassistent als Testfunktion im Dreipunktmenü; bestehende Sprachliste bleibt erhalten.
- Eigene API-Schlüssel pro HA-Installation für Groq, Cloudflare, OpenRouter und Mistral; Modellwahl optional.
- Rückfragen und Korrekturen im Gespräch, Bestandsabfragen und Vorschauen für Verschieben/Wäsche.
- Keine Bearbeitung, Neuanlage oder Löschung von Kleidungseinträgen durch den Assistenten.
- Modellvorschläge werden vor der Anzeige gegen echte Artikel, Orte und Mengen geprüft; Ausführung ausschließlich nach Bestätigung und mit Versionsprüfung.
- Anbieterlimit-/Zugriffsfehler ohne automatische Wiederholungen; Schlüssel bleiben im Backend.
- Gemeinsamer Testplan und Antwortzeitanzeige für den Vergleich. Anbieteradapter mit simulierten Antworten geprüft; reale Modellqualität noch nicht verglichen.

## 0.5.0

- Einheitliches responsives Darkmode-Design; Navigation unten am Handy und seitlich am Desktop.
- Alte eigene Design-Stylesheets entfernt und Gestaltung einschließlich Farbwahl, Konto- und Fehlerseiten zusammengeführt.
- Kompakte Bestandsübersicht, mobile Filter und einzeln entfernbare aktive Filter.
- Gemeinsames Artikelpanel mit Mengen & Orten sowie Details & Foto.
- Suche, Filter, Auswahl und Scrollposition bleiben beim Wechsel zu Artikelseiten erhalten.
- Die bewährten Wäsche-Symbole und Mengenregeln bleiben unverändert.
- Dezente Panel-, Filter- und Bestandsanimationen, mit Unterstützung für reduzierte Bewegung.
- Speichermeldungen ohne Layoutsprung, verbesserter Tastaturfokus und Rücksicht auf Bildschirmtastaturen.
- Schrank-Erfassung, Sicherung und Konto im Dreipunktmenü der Übersicht.

## 0.4.0

- Separater Modus „Schrank erfassen“ unter den Werkzeugen am Ende der Übersicht; „Artikel hinzufügen“ bleibt unverändert.
- Geführte Erfassung: Kategorie und Ort einmal wählen, danach Foto/Etikett und kompakte Angaben je Artikel.
- „Speichern & nächster“ behält Kategorie und Ort in der aktuellen Browsersitzung. Foto und individuelle Angaben werden geleert; die Menge beginnt wieder bei 1.
- Optionale Zusatzfelder einklappbar, Kategorien-/Ortswechsel und „Speichern & beenden“.
- Artikel, Ort und Menge werden atomar gespeichert; wiederholte Speicherversuche desselben Artikels erzeugen keine Duplikate.
- Trennlinie unter der Hauptnavigation entfernt.

## 0.3.0

- Etikettfotos direkt beim Anlegen, Bearbeiten und Klonen lokal im Browser auslesen; keine externen OCR-Dienste.
- Mehrere Etikettfotos, Vorschau, Drehen, Entfernen, Fortschritt und Abbrechen.
- Editierbare Vorschläge für Marke, Größe, Material, Artikelnummer und gedruckte Pflegehinweise mit ausdrücklicher Übernahme.
- Größenregeln für Jeans, Hemdkragen einschließlich Halb-/Viertelzoll, Ärmelbereiche, Doppelgrößen und regionale Angaben. Unsichere Angaben bleiben zur Prüfung markiert.
- Material und Artikelnummer als eigene Felder, in Suche, Sicherung und Klonen berücksichtigt. Bestehende Datenbanken werden automatisch erweitert.
- OCR-Laufzeit und deutsche/englische Modelle werden vollständig von der eigenen App ausgeliefert.

## 0.2.1

- Kleidungsfoto direkt beim Anlegen aufnehmen oder auswählen, mit Vorschau und Entfernen.
- Foto und Angaben werden gemeinsam gespeichert; Hintergrundentfernung ist vor dem Speichern optional möglich.
- Eingaben und Foto bleiben bei einem fehlgeschlagenen Speicherversuch im Formular erhalten.
- Uploadprüfung und Unterstützung für Originalfoto plus freigestellte Variante.

## 0.2.0

- Erste Veröffentlichung als Home-Assistant-App für amd64.
- GitHub-Build mit Typprüfung, Tests, Anmeldung und Neustartprüfung.
- Dauerhafte SQLite-Datenbank, Fotos und Anmeldeschlüssel unter `/data`.
- Konfigurierbare Webadresse und Registrierung, kalte HA-Sicherungen.
- Wohnorte, Gepäck, Mengen, Wäsche, Rückgängig und Sicherung/Import.
- Dunkles Design, deutsche und verwaltbare Farben, Sprachliste und gespeicherte Ortsrichtungen.
