# Multi-Site Panel für Home Assistant

Eine eigene, app-artige Oberfläche für Home Assistant, gedacht fürs iPhone: Sie fühlt sich an wie eine einfache Smart-Home-App eines Herstellers, läuft aber komplett lokal über dein Home Assistant und bringt mehrere Standorte (Hausnummern, Firma, Hallen) in einer App zusammen.

- **Start:** Begrüßung, Wetter, Hinweise (Tor offen, Waschmaschine fertig, Internet weg), Szenen, Favoriten, was gerade läuft, Solar jetzt
- **Orte:** Standort → Etage → Raum mit Licht, Heizung, Rollläden, Geräten und Raumklima
- **Heizung:** Wärmequellen, Heizbetrieb Winter/Sommer, alle Thermostate
- **Versorgung:** jeder Anschluss (Strom, Gas, Holz, Öl, Wasser, Brunnen, Internet) mit Werten, Tagesverlauf und welche Gebäude er versorgt
- **Sicherheit:** Türen, Tore, Schlösser, Kameras und die Ereignisse von heute

Die Struktur kommt aus Home Assistant selbst (Etagen und Räume). Neue Geräte erscheinen automatisch, sobald sie einem Raum zugeordnet sind.

Eingerichtet wird alles im **Editor** („Zuhause bearbeiten“ in der Seitenleiste, nur für Admins): links die Bereiche, in der Mitte die Formulare mit Suche nach Entitäten, rechts die echte App als Live-Vorschau. „Speichern“ schreibt direkt in Home Assistant, die App auf allen Geräten zeigt die Änderung sofort, ohne Neustart.

## Installation

Das Panel ist eine Integration (`custom_components/multisite_panel`). Sie meldet die App („Zuhause“, `/zuhause`) und den Editor („Zuhause bearbeiten“, `/zuhause-editor`) selbst an; YAML und Dashboard-Ressourcen braucht es nicht mehr.

**Über HACS** (Repository muss auf GitHub öffentlich sein): HACS → ⋮ → Benutzerdefinierte Repositories → `https://github.com/xAdler21/HomeAssistantMultiSitePanel`, Typ „Integration“ → „Multi-Site Panel“ herunterladen.

**Von Hand** mit dem File-Editor- oder VS-Code-Add-on (Pfade wie dort, `/homeassistant` = `/config`): den Ordner `custom_components/multisite_panel` mit allen Dateien nach `/homeassistant/custom_components/multisite_panel/` hochladen. Ist der Konfigurationsordner per Samba erreichbar, erledigt das `werkzeuge/deploy.ps1`.

Danach:

1. **Home Assistant neu starten.**
2. **Einstellungen → Geräte & Dienste → Integration hinzufügen → „Multi-Site Panel“.**
3. In der Seitenleiste erscheinen „Zuhause“ und „Zuhause bearbeiten“.

Beim ersten Start übernimmt die Integration eine vorhandene `/homeassistant/art_custom/multisite-panel.yaml` (oder `/homeassistant/multisite-panel.yaml`). Danach liegt die Konfiguration in `.storage/multisite_panel.config` und ist in jedem HA-Backup enthalten.

### Umstieg von der YAML-Variante (Version 0.1)

1. Integration wie oben installieren, **noch nicht** einrichten.
2. In `/homeassistant/art_configs/multisite_panel.yaml` den Block `panel_custom:` löschen (die Helfer `input_select`/`input_boolean` dürfen bleiben, siehe `beispiel/art_configs/`).
3. Die alte Datei `/homeassistant/www/art_custom/multisite-panel.js` löschen und, falls angelegt, die Dashboard-Ressource `/local/art_custom/multisite-panel.js` entfernen. Sonst lädt der Browser die alte Version und die neue kann sich nicht anmelden.
4. Home Assistant neu starten, dann die Integration hinzufügen. `art_custom/multisite-panel.yaml` wird dabei übernommen und kann danach als Sicherung liegen bleiben.

## Editor

- **Bereiche:** Allgemein, Standorte, Versorgung, Heizung, Geräte, Szenen, Sicherheit, Benutzer und YAML.
- **Entitäten** sucht man per Name oder ID; unter dem Feld steht der aktuelle Wert oder ein Hinweis, wenn es die Entität nicht gibt. Listen zeigen fehlende Entitäten als Warnung.
- **Etagen und Räume** kommen als Auswahl direkt aus Home Assistant.
- **Sortieren** per Ziehen oder mit den Pfeilen, **Rückgängig/Wiederholen** mit Strg+Z/Strg+Y, **Speichern** mit Strg+S.
- **Vorschau:** zeigt passend zum Formular den richtigen Bereich der App. „als …“ zeigt die App so, wie ein bestimmter Benutzer sie sieht. Der Kasten darüber meldet Probleme der Einrichtung (fehlende Etagen, Räume, Entitäten).
- **Standort-ID ändern** zieht alle Verweise (Versorgung, Szenen, Benutzer …) mit; beim Löschen eines Standorts werden die Verweise entfernt.
- **YAML:** die ganze Konfiguration als Text, zum Sichern, Kopieren oder Einfügen einer alten `multisite-panel.yaml`.
- Ungespeicherte Änderungen bleiben im Browser erhalten, falls man den Editor verlässt.

Die Vorschau ist die echte App mit echten Geräten: Antippen schaltet wirklich.

## Als Startseite der iPhone-App

Home Assistant bietet eigene Panels nicht als Startseite an, nur Dashboards. Deshalb gibt es die kleine Karte `multisite-start`, die beim Öffnen der App einmal ins Panel weiterleitet. Die Integration lädt sie automatisch, eine Ressource ist nicht nötig.

1. Neues Dashboard „Start“ anlegen, im Rohkonfigurationseditor:
   ```yaml
   views:
     - type: panel
       cards:
         - type: custom:multisite-start
           ziel: /zuhause
   ```
2. Beim Dashboard **⋮ → Als Standard festlegen**.

Zum Bearbeiten dieses Dashboards `?bleiben` an die Adresse hängen, sonst springt es sofort weiter.
Für Familienmitglieder lässt sich die HA-Seitenleiste im Profil aufräumen. Oben links in der App öffnet ein Menü-Symbol die Seitenleiste; im Editor unter Allgemein lässt es sich ausblenden.

## Struktur in Home Assistant

- **Etage** = ein Gebäude oder ein Stockwerk eines Gebäudes (Einstellungen → Bereiche → Etage hinzufügen), z. B. „Werkstatt“, „Büro“, „Waidl Halle“.
- **Räume** den Etagen zuordnen, **Geräte** den Räumen.
- **Favoriten:** Geräten das Label `favorit` geben.
- Was noch keinem Raum zugeordnet ist, zeigt **Orte → Nicht zugeordnet** (nur für Admins).

## Konfiguration

Der Editor deckt alle Schlüssel ab; im YAML-Bereich sieht man sie als Text. Ein Beispiel mit Kommentaren liegt in `beispiel/art_custom/multisite-panel.yaml`.

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
| `ausblenden` | Entitäten, die nirgends erscheinen |

Leistungen dürfen in W oder kW kommen, Energie in Wh oder kWh, das Panel rechnet um.

## Update

**HACS:** Update installieren, Home Assistant neu starten.

**Von Hand:** die Dateien in `/homeassistant/custom_components/multisite_panel/` ersetzen. Wenn sich nur Dateien in `frontend/` geändert haben, reicht **Einstellungen → Geräte & Dienste → Multi-Site Panel → ⋮ → Neu laden**; bei Python-Dateien ist ein Neustart nötig. Die Integration hängt das Dateidatum als `?v=` an, deshalb lädt auch die iOS-App die neue Version.

Die Konfiguration bleibt bei Updates erhalten.

## Lokale Vorschau ohne Home Assistant

```
powershell -ExecutionPolicy Bypass -File .\werkzeuge\vorschau-server.ps1
```

- `http://localhost:8765/dev/vorschau.html`: die App mit Beispieldaten aus `dev/mock-hass.js` (`?hell` oder `?dunkel` erzwingt das Farbschema).
- `http://localhost:8765/dev/editor.html`: der Editor. Gespeichert wird in den Browser-Speicher; `dev/vorschau.html?speicher` im selben Browser zeigt Änderungen live. `?zuruecksetzen` stellt die Beispieldaten wieder her. Der Mock kann kein YAML, im YAML-Bereich erscheint deshalb JSON.

Die Vorschau lädt die Icons aus dem Internet; Panel und Editor selbst brauchen kein Internet.

## Grenzen

- **Der Filter `benutzer` ist nur ein Sichtfilter.** Home Assistant kennt (Stand 2026.9) keine Rechte pro Gerät; wer angemeldet ist, kann technisch alles schalten und in Verlauf und Logbuch alles sehen.
- **Kameras:** Die Kacheln zeigen Standbilder, das Live-Bild öffnet sich im Kamera-Dialog von Home Assistant.
- **Verlauf:** Das Diagramm zeigt nur den heutigen Tag.
- **Mitteilungen:** Push-Mitteilungen (z. B. „Waschmaschine fertig“) laufen über HA-Automationen; ein Beispiel steht in `beispiel/art_configs/multisite_panel.yaml`.

## Aufbau

- `custom_components/multisite_panel/`: die Integration
  - `__init__.py`: meldet App, Editor und Startseiten-Karte an, speichert die Konfiguration und liefert sie per Websocket aus
  - `frontend/multisite-panel.js`: die App (eine Datei, kein Build-Schritt)
  - `frontend/multisite-editor.js`: der Editor
  - `frontend/multisite-start.js`: die Startseiten-Karte
- `hacs.json`: für die Installation über HACS
- `beispiel/`: Helfer-Paket (`art_configs/`) und Beispielkonfiguration (`art_custom/`)
- `dev/`: lokale Vorschau von App und Editor mit Beispieldaten
- `werkzeuge/`: Kopier-Skript und Vorschau-Server
- `prototyp/`: der ursprüngliche klickbare Entwurf
