# Korb · Einkauf & Rezepte

Eine lokale, installierbare iPhone-Webapp mit mehreren Einkaufslisten,
manuell gepflegten Rezepten, Portionsberechnung und Drag & Drop.
Die erste Version benötigt keine Anmeldung und keinen Backend-Dienst.

**App öffnen:** [Korb auf dem iPhone](https://jrottergit.github.io/Shopping/).
In Safari öffnen und über **Teilen → Zum Home-Bildschirm** hinzufügen.

## Lokal starten

Benötigt Node.js 22.12+ oder Node.js 24. Getestet mit Node.js 24.

```sh
npm ci
npm run dev
```

Die Entwicklungsadresse wird im Terminal angezeigt. Die Offline-Funktion ist
im Produktionsbuild aktiv:

```sh
npm run build
npm run preview
```

Die App kann nicht durch Doppelklick auf `index.html` gestartet werden.
IndexedDB, PWA und Service Worker benötigen einen passenden Web-Ursprung;
verwende lokal `localhost` und auf dem iPhone eine HTTPS-Adresse.

## GitHub Pages

1. Projektdateien einschließlich `package-lock.json` und `.github/` in das
   GitHub-Repository übernehmen. `node_modules`, `work` und `dist` sind ausgenommen.
2. Unter **Settings → Pages → Build and deployment** die Quelle **GitHub Actions** wählen.
3. Änderungen auf `main` pushen oder den Workflow **Test and publish Korb** starten.
4. Nach erfolgreicher Ausführung die Adresse aus dem Deployment öffnen.

Der Workflow berechnet automatisch den Pfad `/<Repositoryname>/`.
Für eine eigene Domain den Konfigurationsschritt auf `app_base="/"` anpassen.
Zum lokalen Prüfen des Unterpfades:

```sh
VITE_BASE_PATH=/Shopping/ npm run build
npm run preview
```

Dann `http://localhost:4173/Shopping/` öffnen. GitHub Pages ist bei GitHub Free
für öffentliche Repositories verfügbar; private Repositories können einen
entsprechenden GitHub-Tarif benötigen. Einkaufsdaten und Sicherungsdateien
gehören nicht in das Repository.

## Auf dem iPhone

1. Die HTTPS-Adresse in Safari öffnen.
2. **Teilen → Zum Home-Bildschirm** wählen und als Webapp hinzufügen.
3. Die installierte App einmal mit Internet öffnen und das Laden abschließen.
4. Artikel hinzufügen, App schließen und im Flugmodus erneut öffnen.

Safari und die installierte App sollten separat geprüft werden. Führe einen
Export aus, bevor du Browserdaten löschst, die App entfernst oder auf eine andere
Domain wechselst. Die Daten werden auf dem jeweiligen Gerät gespeichert.
Browser-Speicherung ersetzt keine Datensicherung und synchronisiert keine Geräte.

## Funktionen

- Listen anlegen, umbenennen, wechseln, archivieren und wiederherstellen.
- Artikel schnell ergänzen oder Menge, Einheit und Kategorie angeben.
- Artikel zwischen Listen verschieben; Mengenbeiträge bleiben nachvollziehbar.
- Kategorien anlegen, umbenennen, entfernen und ordnen. Beim Entfernen wandern
  Artikel nach **Unsortiert**.
- Finger-Drag am Ziehgriff: kurze Haltezeit, dann verschieben. Normales Scrollen
  funktioniert außerhalb des Griffs. Leere Kategorien erscheinen während des Ziehens.
- Alternativ Mengen und Kategorie über das Artikelmenü ändern; Kategorien können
  auch mit Pfeiltasten-Schaltflächen sortiert werden.
- Artikel abhaken und erledigte Einträge gesammelt entfernen.
- Rezepte manuell anlegen, bearbeiten, suchen, favorisieren und löschen.
- Ein oder mehrere Rezepte auswählen, Portionen einstellen, vorhandene Zutaten
  abwählen und den Bedarf in eine ausgewählte Liste übernehmen.
- Geplante Rezepte über **Listenoptionen → Geplante Rezepte** anpassen oder entfernen.
- Vollständige JSON-Sicherungen exportieren und nach Vorschau wiederherstellen.
- Helle, dunkle oder systemabhängige Darstellung.

## Mengen und Rezeptbedarf

g/kg und ml/l werden vereinheitlicht. Stück, Esslöffel und andere Einheiten bleiben
getrennt. Namen werden hinsichtlich Groß-/Kleinschreibung und Leerzeichen
verglichen; unterschiedliche Zutaten werden nicht automatisch gleichgesetzt.
Brüche und Dezimalkomma sind bei der Mengeneingabe erlaubt.

Manuelle Mengen und Rezeptmengen sind getrennte Beiträge. Entfernen eines
Rezeptbedarfs erhält manuelle Ergänzungen. Spätere Änderungen an der Rezeptbibliothek
ändern vorhandenen Einkaufsbedarf nicht. Beim Aktualisieren geplanter Portionen
bleiben bereits abgehakte Zutaten erhalten; offene Mengen werden neu berechnet.
Wird eine Rezeptzutat in eine andere Liste verschoben, gehört nur dieser Bedarf
dort zur Rezeptplanung. Bereits gekaufte Mengen werden nicht mit neuem Bedarf addiert.

## Datensicherung

Unter **Einstellungen → Sicherung exportieren** die Datei in „Dateien“ speichern.
Eine Wiederherstellung ersetzt nach Vorschau die Daten auf dem aktuellen Gerät.
Vorher wird eine Sicherung des bisherigen Stands zum Speichern bereitgestellt.
Fehlerhafte oder unvollständige Dateien werden abgewiesen.

## Prüfungen

```sh
npm test
npm run build
npm run test:e2e
npm run format:check
```

Für Browserprüfungen verwendet die Konfiguration Chromium unter `/usr/bin/chromium`.
Auf anderen Rechnern `CHROMIUM_PATH` auf die eigene Chromium-/Chrome-Binärdatei setzen.
Alternativ `npx playwright install chromium` ausführen und `CHROMIUM_PATH=playwright`
verwenden. Die GitHub-Workflows installieren diesen Browser automatisch.
Die Tests prüfen Desktop und mobile Touch-Eingaben einschließlich Offline-Neustart.
Sie ersetzen keinen Test auf einem echten iPhone. Review-Ergebnisse stehen unter
`docs/REVIEWS.md`, Umfang und Regeln unter `docs/PLAN.md`.

## Architektur

- `src/model.ts`: Typen, Eingabe- und Sicherungsvalidierung.
- `src/domain.ts`: unabhängige Regeln für Mengen, Listen und Rezeptbedarf.
- `src/db.ts`: atomare IndexedDB-Speicherung, Sicherungen und Wiederherstellung.
- `src/Shopping.tsx`, `src/Recipes.tsx`: Einkaufs- und Rezeptbedienung.
- `src/App.tsx`: Navigation, Dialoge und Einstellungen.
- `vite.config.ts`: PWA, Offline-Cache und Hosting-Unterpfad.

Für eine spätere Haushalts-Synchronisierung müssen zusätzlich Anmeldung,
Konfliktregeln und eine Datenmigration implementiert werden.
