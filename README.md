# Multi-Site Panel für Home Assistant

Eine eigene, app-artige Oberfläche für Home Assistant, gedacht fürs iPhone: Sie fühlt sich an wie eine einfache Smart-Home-App eines Herstellers, läuft aber komplett lokal über dein Home Assistant und bringt mehrere Standorte (Hausnummern, Firma, Hallen) in einer App zusammen.

- **Start:** Begrüßung, Wetter, Hinweise (Tor offen, Waschmaschine fertig, Internet weg), Szenen, Favoriten, was gerade läuft, Solar jetzt
- **Orte:** Standort → Etage → Raum mit Licht, Heizung, Rollläden, Geräten und Raumklima
- **Heizung:** Wärmequellen, Heizbetrieb Winter/Sommer, alle Thermostate
- **Versorgung:** jeder Anschluss (Strom, Gas, Holz, Öl, Wasser, Brunnen, Internet) mit Werten, Tagesverlauf und welche Gebäude er versorgt
- **Sicherheit:** Türen, Tore, Schlösser, Kameras und die Ereignisse von heute

Die Struktur kommt aus Home Assistant selbst (Etagen und Räume). Neue Geräte erscheinen automatisch, sobald sie einem Raum zugeordnet sind.

## Installation

Die YAML-Konfiguration liegt in `/homeassistant/art_configs/` und wird als Pakete geladen (Pfade wie im File-Editor- oder VS-Code-Add-on, entspricht `/config/`):

```yaml
# configuration.yaml
homeassistant:
  packages: !include_dir_named art_configs
```

`beispiel/` bildet diese Ordner nach. Die Dateien kommen so auf den HA-Server:

| aus dem Repository | nach | wofür |
|---|---|---|
| `multisite-panel.js` | `/homeassistant/www/art_custom/` | das Panel, im Browser unter `/local/art_custom/multisite-panel.js` |
| `beispiel/art_custom/multisite-panel.yaml` | `/homeassistant/art_custom/` | Standorte, Anschlüsse usw. (außerhalb von `www`, also nicht öffentlich abrufbar) |
| `beispiel/art_configs/multisite_panel.yaml` | `/homeassistant/art_configs/` | Paket mit `panel_custom` und den optionalen Helfern |

1. **Ordner anlegen** und die drei Dateien im Add-on hochladen (File Editor: Ordnersymbol → Hochladen; VS Code: Datei in den Explorer ziehen).
   Ist der Konfigurationsordner per Samba erreichbar, kopiert `werkzeuge/deploy.ps1` die JS-Datei:
   ```
   powershell -ExecutionPolicy Bypass -File .\werkzeuge\deploy.ps1 -Ziel "\\homeassistant.local\config"
   ```
2. **`multisite-panel.yaml` anpassen.** Sie darf nicht in `art_configs` liegen, sonst lädt HA sie als eigenes Paket und meldet einen Fehler.
3. **Entwicklerwerkzeuge → YAML → Konfiguration prüfen**, dann **Home Assistant neu starten.** In der Seitenleiste erscheint „Zuhause“ (Adresse `/zuhause`).
4. Als Admin **Orte → Einrichtung prüfen** öffnen. Dort steht, welche Etagen, Räume und Entitäten aus der Konfiguration fehlen, und welche Etagen-IDs es in HA gibt.

## Als Startseite der iPhone-App

Home Assistant bietet eigene Panels nicht als Startseite an, nur Dashboards. Deshalb gibt es die kleine Karte `multisite-start`, die beim Öffnen der App einmal ins Panel weiterleitet:

1. **Einstellungen → Dashboards → ⋮ → Ressourcen → Ressource hinzufügen**
   URL genau wie bei `module_url`, also `/local/art_custom/multisite-panel.js?v=0.1.0`, Typ „JavaScript-Modul“.
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

Alles steht in `multisite-panel.yaml`. Ein vollständiges Beispiel mit Kommentaren liegt in `beispiel/art_custom/`.

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

1. Neue `multisite-panel.js` nach `/homeassistant/www/art_custom/` hochladen.
2. In `art_configs/multisite_panel.yaml` und in der Dashboard-Ressource `?v=` auf die neue Version setzen.
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
- **Mitteilungen:** Push-Mitteilungen (z. B. „Waschmaschine fertig“) laufen über HA-Automationen; ein Beispiel steht in `beispiel/art_configs/multisite_panel.yaml`.

## Aufbau

- `multisite-panel.js`: das Panel und die Startseiten-Karte (eine Datei, kein Build-Schritt)
- `beispiel/`: Paket (`art_configs/`) und Panel-Konfiguration (`art_custom/`), Ordner wie auf dem HA-Server
- `dev/`: lokale Vorschau mit Beispieldaten
- `werkzeuge/`: Kopier-Skript und Vorschau-Server
- `prototyp/`: der ursprüngliche klickbare Entwurf
