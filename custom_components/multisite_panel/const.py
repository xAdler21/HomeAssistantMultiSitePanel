"""Konstanten des Multi-Site Panels."""

DOMAIN = "multisite_panel"

# Unter dieser Adresse liefert HA die Dateien aus frontend/ aus
STATIC_URL = "/multisite_panel"

PANEL_URL = "zuhause"
PANEL_TITLE = "Zuhause"
PANEL_ICON = "mdi:home"
EDITOR_URL = "zuhause-editor"
EDITOR_TITLE = "Zuhause bearbeiten"
EDITOR_ICON = "mdi:pencil-ruler"

STORAGE_KEY = f"{DOMAIN}.config"
STORAGE_VERSION = 1
SIGNAL_UPDATED = f"{DOMAIN}_updated"

# Beim ersten Start wird eine vorhandene YAML-Konfiguration übernommen (Pfade relativ zu /config)
YAML_IMPORT = ("art_custom/multisite-panel.yaml", "multisite-panel.yaml")

# Bilder der Lagepläne: liegen in /config/multisite_panel/ (nicht unter www, also nicht öffentlich)
# und werden nur angemeldeten Benutzern ausgeliefert (im Browser über signierte Adressen)
BILD_ORDNER = "multisite_panel"
BILD_URL = "/api/multisite_panel/bild"
BILD_TYPEN = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
BILD_MAX_BYTES = 40 * 1024 * 1024
# Hochgeladene, aber nirgends verwendete Bilder werden erst nach dieser Zeit gelöscht (Entwurf noch nicht gespeichert)
BILD_AUFHEBEN_SEKUNDEN = 24 * 3600
