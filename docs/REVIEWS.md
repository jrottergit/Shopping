# Umsetzungsreviews – Version 0.1

Die Reviews begleiten die Umsetzung in einzelnen Abschnitten. Die automatisierten
Ergebnisse unten stammen aus der Entwicklungsumgebung. Der erste GitHub-Lauf und
die Vorbereitung der Veröffentlichung sind zusätzlich in Review 4 dokumentiert.

## Review 1: Daten und Einkaufslisten

Ergebnis: Lokale Speicherung, Listen und Kategorien sind implementiert.
Änderungen werden innerhalb einer IndexedDB-Transaktion auf dem neuesten Zustand
ausgeführt. Gleichzeitige Änderungen verlieren keine Artikel; ungültige Änderungen
werden vollständig zurückgerollt.

Geprüft: Kategorienwechsel, Reihenfolge, Neustart, Archivierung und mindestens
eine aktive Liste. Beim Entfernen einer Kategorie bleiben ihre Artikel erhalten.
Geöffnete und erledigte Mengen werden getrennt behandelt.

Korrekturen aus dem Review: Explizite Feldbeschriftungen; sichtbare Hinweise
innerhalb geöffneter Dialoge; ausreichend große Touch-Flächen; bessere Lesbarkeit
sekundärer Texte; stabile Position des gezogenen Artikels beim Einblenden leerer Ziele.

## Review 2: Rezepte und Mengen

Ergebnis: Manuelle Rezeptpflege, Portionsberechnung, Zutatenvorschau und Planung
mehrerer Rezepte sind implementiert.

Geprüft: g/kg und ml/l, unvereinbare Einheiten, Mengen ohne Zahlenwert,
Dezimalkomma und Brüche, unabhängige Rezept-Momentaufnahmen, Erhalt manueller
Beiträge und bereits gekaufter Zutaten.

Korrekturen aus dem Review: Kategorie und Position bleiben bei Portionsänderungen
erhalten. Verschobene Rezeptzutaten werden ihrer Zielliste zugeordnet; spätere
Portionsänderungen auf der Ausgangsliste erzeugen sie dort nicht erneut.

## Review 3: Sicherung, Offline und Hosting

Ergebnis: Vollständiger JSON-Export, geprüfte Wiederherstellung und PWA sind
implementiert. Format, IDs und Referenzen werden vor einer Wiederherstellung
validiert. Fehlerhafte Dateien lassen vorhandene Daten unangetastet.

Geprüft: Offline-Neustart, neue Artikel ohne Internet und wiederholtes Laden.
Zusätzlich wurde ein separater Produktionsbuild unter `/Shopping/` geprüft:
Manifest-Startadresse und Service-Worker-Scope stimmen; Offline-Neustart und
Neuladen der Rezeptansicht über eine Hash-Route funktionieren ohne Laufzeitfehler.

Der Offline-Cache enthält App-Dateien; Nutzerdaten bleiben separat in IndexedDB.
Ein neues App-Bundle löscht diese Daten nicht. Bei einem Update erfolgt der Neustart
erst nach bewusster Auswahl und abgeschlossenen Speichervorgängen. Die Architektur
verwendet ein versioniertes Datenformat; eine spätere Formatänderung benötigt eine
explizite Datenmigration.

## Automatisierte Ergebnisse

- 25 Fach- und Speichertests bestanden.
- 40 Browserprüfungen bestanden: jeweils 10 am Desktop und 10 mit mobilem Viewport
  und Touch, sowohl am Wurzelpfad als auch unter dem GitHub-Unterpfad `/Shopping/`.
- Die Touch-Tests erzeugen echte Touch-Ereignisse im Chromium-Testbrowser.
- Geprüft sind Finger-Drag in leere und zugeklappte Kategorien, Artikelsortierung,
  Kategorienreihenfolge, Rezeptpflege, Mehrfachplanung, Sicherung und Offline-Nutzung.
- TypeScript-Prüfung und Produktionsbuild bestanden.
- Formatierungsprüfung bestanden; Quellcode und Review-Dokumente sind einheitlich formatiert.
- Produktionsabhängigkeiten: npm-Audit meldete zum Prüfzeitpunkt keine bekannten
  Schwachstellen. Das ist keine Garantie für zukünftige Abhängigkeiten.
- Die Oberfläche verwendet Systemschriften und benötigt keine externen Bild- oder
  Schriftserver. Einkaufsdaten werden nicht an einen Backend-Dienst übertragen.

## Regelmäßige Prüfungen bei weiteren Änderungen

Der Pull-Request-Workflow prüft Formatierung, Fachtests, Produktionsbuild und
Browserabläufe. Derselbe Prüfablauf läuft vor der GitHub-Pages-Veröffentlichung.
Zusätzlich prüfen wir bei Änderungen an Mengen die Herkunft und Summen; bei
Speicheränderungen Sicherungs-Rundlauf und Migration; bei Gestenänderungen
Scrollen, leere Ziele, zugeklappte Kategorien und gespeicherte Reihenfolge.

## Review 4: Veröffentlichung auf GitHub

Der vollständige App-Code liegt auf `main` in `jrottergit/Shopping`.
Im ersten GitHub-Lauf bestanden Formatierung, alle 25 Fach- und Speichertests
und der Produktionsbuild. Von 20 Browserprüfungen bestanden 19; der mobile Test
für das Öffnen zugeklappter Kategorien schlug fehl.

Der Test wartete nach dem Schließen und beim Start der Ziehgeste auf feste
Zeitspannen. Er prüft jetzt den abgeschlossenen Zustandswechsel, die aktive
Ziehgeste und das Öffnen der Zielkategorie vor dem Loslassen. Die Touch-Prüfung
bestand anschließend fünfmal in Folge in der Entwicklungsumgebung; danach
bestanden alle 20 Browserprüfungen unter `/Shopping/`.

Die administrative Änderung der Repository-Sichtbarkeit war aus dieser Umgebung
mit HTTP 403 gesperrt. Der Eigentümer hat das Repository öffentlich gestellt und
GitHub Pages mit der Quelle **GitHub Actions** aktiviert.
Der Workflow prüft die App vollständig vor dem Deployment.
Den aktuellen Stand zeigt
[GitHub Actions](https://github.com/jrottergit/Shopping/actions/workflows/pages.yml).

## Review 5: Erfolgreiche Veröffentlichung am 9. Oktober 2026

Der erneut gestartete Workflow bestand Formatierung, alle 25 Fach- und Speichertests,
Produktionsbuild und alle 20 Browserprüfungen. Konfiguration, Upload und Deployment
von GitHub Pages waren erfolgreich. GitHub meldet als veröffentlichte Adresse
[Korb](https://jrottergit.github.io/Shopping/).

Die ausgelieferte App basiert auf Commit `2e1cd19`. Der direkte HTTP-Abruf dieser
Domain ist in der Entwicklungsumgebung durch die Netzwerkregel mit HTTP 403
gesperrt; auch das Web-Lesewerkzeug konnte die Adresse nicht öffnen.
Die Veröffentlichung ist durch den erfolgreichen GitHub-Deployment-Lauf bestätigt.
Ein vollständiger Test auf dem echten iPhone bleibt Teil der Geräteabnahme.

## Noch ausstehend

- Prüfung auf einem echten iPhone mit Safari und installierter Home-Bildschirm-App:
  Tastatur, Randscrollen, VoiceOver, Fingerbedienung und Offline-Neustart.
- Öffnen der veröffentlichten Adresse in Safari auf dem iPhone.
- Ein vollständiger Update-Wechsel zwischen zwei veröffentlichten App-Versionen
  auf dem iPhone. Die Trennung von Offline-Cache und Nutzerdaten ist bereits vorhanden.

Diese Punkte verhindern keinen lokalen Entwicklungsstart; sie gehören zur
Abnahme der iPhone-Veröffentlichung. Browser-Emulation ersetzt den Gerätetest nicht.
