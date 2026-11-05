# Meine Kleidung für Home Assistant

Persönliche Kleidungsverwaltung auf Basis von [Libre Closet](https://github.com/Lazztech/Libre-Closet), erweitert um Wohnorte, Mengen, Wäsche, Sprachlisten, gespeicherte Ortsrichtungen und ein dunkles Design.

## Installation

Die Installationsquelle ist **https://github.com/KO0K0/meine-kleidung-ha#ha-store**. Der Zweig entsteht erst nach dem ersten erfolgreichen Build und Container-Test.

[Repository zu Home Assistant hinzufügen](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FKO0K0%2Fmeine-kleidung-ha%23ha-store)

[Anleitung](meine_kleidung/DOCS.md) · [Änderungen](meine_kleidung/CHANGELOG.md) · [Build-Status](https://github.com/KO0K0/meine-kleidung-ha/actions)

Unterstützt wird Home Assistant OS auf amd64 (Intel/AMD). Die App läuft auf Port 3088 mit eigener Anmeldung. Ingress ist noch nicht enthalten. Fotos und Datenbank bleiben im dauerhaften App-Verzeichnis `/data`.

## Updates veröffentlichen

1. Änderungen im Ordner `meine_kleidung` vornehmen und die Versionsnummer in `config.json` erhöhen.
2. Nach `main` übertragen. GitHub baut und testet das Container-Image, einschließlich Anmeldung, Bestand und Datenerhaltung nach einem Neustart.
3. Bei der ersten Veröffentlichung unter GitHub → Packages → meine-kleidung-ha → Package settings das Paket auf **Public** stellen. Danach den fehlgeschlagenen Workflow erneut ausführen. Er verwendet dasselbe Image, wenn dessen Quellcode-Revision übereinstimmt.
4. Erst nach erfolgreicher Prüfung des öffentlichen Downloads aktualisiert der Workflow den Zweig `ha-store`. Danach bietet Home Assistant die neue Version an.

Bereits veröffentlichte Versionsnummern dürfen nicht für geänderten Quellcode wiederverwendet werden. Vor einem Update eine HA-Sicherung anlegen. Der Rückweg bei Datenbankänderungen erfolgt über die vollständige Sicherung von App und Daten.

## Entwicklung und Lizenz

Der Quellcode liegt vollständig unter `meine_kleidung`, die Veröffentlichung unter `.github/workflows/release.yml`. Ein Container-Build führt Typprüfung, Tests und Produktionsbuild aus. `ci/smoke.cjs` prüft die laufende App. Die Windows-Testversion bleibt unabhängig nutzbar.

Basis: Libre Closet 0.6.0, Commit `08f66dd9fe071e3b62e529d0ca4050169d31532d`. Lizenz AGPL-3.0, siehe [LICENSE](LICENSE). Bibliotheken behalten ihre jeweiligen Lizenzen. Dieses Repository enthält keine persönlichen Bestände, Fotos, Datenbanken oder Zugangsschlüssel.
