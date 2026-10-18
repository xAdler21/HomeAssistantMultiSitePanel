# Multi-Site Panel für Home Assistant

Eine eigene, app-artige Oberfläche für Home Assistant, gedacht fürs iPhone: Sie fühlt sich an wie eine einfache Smart-Home-App eines Herstellers, läuft aber komplett lokal über dein Home Assistant und bringt mehrere Standorte (Hausnummern, Firma, Hallen) in einer App zusammen.

- **Start:** Begrüßung, Wetter, Hinweise (Tor offen, Waschmaschine fertig, Internet weg), Szenen, Favoriten, was gerade läuft, Solar jetzt
- **Orte:** Standort → Etage → Raum mit Licht, Heizung, Rollläden, Geräten und Raumklima
- **Heizung:** Wärmequellen, Heizbetrieb Winter/Sommer, alle Thermostate
- **Versorgung:** jeder Anschluss (Strom, Gas, Holz, Öl, Wasser, Brunnen, Internet) mit Werten, Tagesverlauf und welche Gebäude er versorgt
- **Sicherheit:** Türen, Tore, Schlösser, Kameras und die Ereignisse von heute

Die Struktur kommt aus Home Assistant selbst (Etagen und Räume). Neue Geräte erscheinen automatisch, sobald sie einem Raum zugeordnet sind.

## Installation

1. **Datei kopieren:** `multisite-panel.js` nach `/config/www/multisite-panel/` auf dem HA-Server.
   Mit dem Samba-Add-on geht das per Skript:
   ```
   powershell -ExecutionPolicy Bypass -File .\werkzeuge\deploy.ps1 -Ziel "\\homeassistant.local\config"
   ```
2. **Konfiguration anlegen:** `beispiel/multisite-panel.yaml` nach `/config/multisite-panel.yaml` kopieren und anpassen.
3. **Panel eintragen:** den `panel_custom`-Block aus `beispiel/configuration.yaml` in die `configuration.yaml` übernehmen.
4. **Home Assistant neu starten.** In der Seitenleiste erscheint „Zuhause“ (Adresse `/zuhause`).
5. Als Admin **Orte → Einrichtung prüfen** öffnen. Dort steht, welche Etagen, Räume und Entitäten aus der Konfiguration fehlen, und welche Etagen-IDs es in HA gibt.

## Als Startseite der iPhone-App

Home Assistant bietet eigene Panels nicht als Startseite an, nur Dashboards. Deshalb gibt es die kleine Karte `multisite-start`, die beim Öffnen der App einmal ins Panel weiterleitet:

1. **Einstellungen → Dashboards → ⋮ → Ressourcen → Ressource hinzufügen**
   URL genau wie bei `module_url`, also `/local/multisite-panel/multisite-panel.js?v=0.1.0`, Typ „JavaScript-Modul“.
2. Neues Dashboard „Start“ anlegen, im Rohkonfigurationseditor:
   ```yaml
   views:
     - type: panel
       cards:
         - type: custom:multisite-start
           ziel: /zuhause
   ```
3. Beim Dashboard **⋮ → Als Standard festlegen**.

Zum Bearbeiten dieses Dashboards `?bleiben` an die Adresse hängen, sonst springt es sofort weiter.
Für Familienmitglieder lässt sich die HA-Seitenleiste im Profil aufräumen. Oben links im Panel öffnet ein Menü-Symbol die Seitenleiste; mit `menue_knopf: false` wird es ausgeblendet.

## Struktur in Home Assistant

- **Etage** = ein Gebäude oder ein Stockwerk eines Gebäudes (Einstellungen → Bereiche → Etage hinzufügen), z. B. „Werkstatt“, „Büro“, „Waidl Halle“.
- **Räume** den Etagen zuordnen, **Geräte** den Räumen.
- **Favoriten:** Geräten das Label `favorit` geben.
- Was noch keinem Raum zugeordnet ist, zeigt **Orte → Nicht zugeordnet** (nur für Admins).

## Konfiguration

Alles steht in `multisite-panel.yaml`. Ein vollständiges Beispiel mit Kommentaren liegt in `beispiel/`.

| Schlüssel | Bedeutung |
|---|---|
| `standorte` | `id`, `name`, `kurz`, `kuerzel`, `rolle`, `icon`, `etagen` (ID oder Name), `bereiche` (Räume ohne Etage) |
| `wetter`, `aussentemperatur` | Wetter-Entität und Außenfühler für die Startseite |
| `favoriten_label`, `favoriten` | Label (Standard `favorit`) und/oder Liste von Entitäten |
| `versorgung` | Anschlüsse mit `art`, `standorte`, `messung`, `leistung`, `solar`, `netz`, `*_heute`, `status`, `werte`, `versorgt`, `saison`, `hinweis`, `geplant` |
| `heizsaison` | optional `entity` (input_select mit „Winter“/„Sommer“), sonst Oktober bis April = Winter |
| `geraete` | Wasch-/Spülmaschine & Co. über `status` oder `leistung` + `schwelle`, optional `restzeit`, `fortschritt`, `programm`, `mitteilung` |
| `zugang`, `kameras`, `ereignisse` | zusätzliche Türen/Tore/Schlösser und Kameras; Ereignisse für „Heute“ |
| `szenen` | Szenen, Skripte oder Buttons auf der Startseite |
| `benutzer` | welcher HA-Benutzer welche Standorte sieht |
| `menue_knopf` | `false` blendet das Menü-Symbol aus |

Leistungen dürfen in W oder kW kommen, Energie in Wh oder kWh, das Panel rechnet um.

## Update

1. Neue `multisite-panel.js` kopieren.
2. In `configuration.yaml` und in der Dashboard-Ressource `?v=` auf die neue Version setzen.
3. Home Assistant neu starten.

Ohne neue `?v=`-Nummer zeigt die iOS-App oft noch die alte Version aus dem Zwischenspeicher. Änderungen an `multisite-panel.yaml` brauchen ebenfalls einen Neustart.

## Lokale Vorschau ohne Home Assistant

```
powershell -ExecutionPolicy Bypass -File .\werkzeuge\vorschau-server.ps1
```

Dann `http://localhost:8765/dev/vorschau.html` öffnen (mit `?hell` oder `?dunkel` für das Farbschema). Die Vorschau nutzt Beispieldaten aus `dev/mock-hass.js` und lädt die Icons aus dem Internet; das Panel selbst braucht kein Internet.

## Grenzen

- **Der Filter `benutzer` ist nur ein Sichtfilter.** Home Assistant kennt (Stand 2026.9) keine Rechte pro Gerät; wer angemeldet ist, kann technisch alles schalten und in Verlauf und Logbuch alles sehen.
- **Kameras:** Die Kacheln zeigen Standbilder, das Live-Bild öffnet sich im Kamera-Dialog von Home Assistant.
- **Verlauf:** Das Diagramm zeigt nur den heutigen Tag.
- **Mitteilungen:** Push-Mitteilungen (z. B. „Waschmaschine fertig“) laufen über HA-Automationen; ein Beispiel steht in `beispiel/configuration.yaml`.

## Aufbau

- `multisite-panel.js`: das Panel und die Startseiten-Karte (eine Datei, kein Build-Schritt)
- `beispiel/`: Konfiguration und `configuration.yaml`-Ausschnitt
- `dev/`: lokale Vorschau mit Beispieldaten
- `werkzeuge/`: Kopier-Skript und Vorschau-Server
- `prototyp/`: der ursprüngliche klickbare Entwurf
