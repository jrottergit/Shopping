# Korb – lokale Version 0.1

Stand: 8. Oktober 2026. Die lokale erste Version ist umgesetzt und wurde in
überprüfbaren Abschnitten geprüft. Ergebnisse und noch offene Gerätetests stehen
in `REVIEWS.md`.

## Vereinbarter Umfang

- iPhone-PWA auf GitHub Pages, lokale Daten, keine Anmeldung oder Synchronisierung.
- Mehrere benannte Listen, manuelle Artikel und frei verwaltbare Kategorien.
- Artikel innerhalb und zwischen Kategorien sowie Kategorien per Finger verschieben.
- Rezepte manuell anlegen, bearbeiten und durchsuchen; Portionen skalieren.
- Rezeptbedarf mit Zutatenvorschau in eine ausgewählte Liste übernehmen.
- Kompatible Mengen zusammenfassen; Herkunft und manuelle Mengen erhalten.
- Abhaken, erledigte Artikel entfernen, Listen archivieren.
- Vollständige Sicherung exportieren und nach Prüfung wiederherstellen.
- Offline nach erfolgreichem erstmaligem Laden; Daten bei Updates erhalten.

## Umsetzung und Review-Punkte

1. Datenmodell, lokale Speicherung, Listen, Artikel, Kategorien und Drag & Drop.
   Review: atomare Änderungen, Zustand nach Neustart, leere Kategorien, Scrollgesten.
2. Rezepte und Einkaufsbedarf.
   Review: Portionsberechnung, Einheiten, erneute Übernahme, manuelle Mengen, gekaufte Artikel.
3. Sicherung, PWA und GitHub Pages.
   Review: ungültige Dateien, vollständige Wiederherstellung, Offline-Kaltstart, Unterpfad.
4. Gesamtabläufe und Übergabe.
   Review: Build, Domain-Tests, mobile Browserabläufe, Bedienbarkeit und Dokumentation.

## Regeln

Einkaufsbedarf besteht aus unabhängigen Mengenbeiträgen (manuell oder Rezept).
g/kg sowie ml/l werden auf g/ml normalisiert. Namen werden nur in Schreibweise
und Leerzeichen vereinheitlicht, nicht semantisch. Erledigte und offene Artikel
werden nicht zusammengerechnet. Rezeptbedarf enthält eine Momentaufnahme.
Bei einer Aktualisierung der Portionen bleiben bereits gekaufte Zutaten bestehen;
nur offene Zutaten werden neu berechnet. Entfernen eines Rezeptbedarfs entfernt
seine Beiträge, jedoch keine manuellen Beiträge. Eine Kategorie zu löschen
verschiebt ihre Artikel nach Unsortiert. Mindestens eine Liste bleibt aktiv.

Die IndexedDB-Speicherung verwendet eine versionierte, atomar geschriebene
Momentaufnahme hinter einem Speicheradapter. Spätere Synchronisierung erfordert
zusätzlich Anmeldung, Konfliktregeln und Migration; sie ist nicht automatisch vorhanden.

## Noch auf einem echten iPhone zu prüfen

Home-Bildschirm-Installation, Finger-Drag, Randscrollen, Tastatur, VoiceOver und
Offline-Neustart. Automatisierte WebKit-Tests ersetzen diesen Gerätetest nicht.
