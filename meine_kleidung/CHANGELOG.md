# Änderungen

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
