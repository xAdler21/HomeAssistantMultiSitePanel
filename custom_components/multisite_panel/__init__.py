"""Multi-Site Panel: eigene App-Oberfläche für mehrere Standorte, mit Editor.

Die Konfiguration liegt in .storage/multisite_panel.config. Der Editor speichert über den
Websocket, die App bekommt Änderungen sofort mitgeteilt (kein Neustart nötig).
"""

from __future__ import annotations

import hashlib
from http import HTTPStatus
import logging
from pathlib import Path
import re
import time
from typing import Any

from aiohttp import web
import voluptuous as vol
import yaml

from homeassistant.components import frontend, panel_custom, websocket_api
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import (
    async_dispatcher_connect,
    async_dispatcher_send,
)
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType
from homeassistant.util.yaml import dump as yaml_dump

from .const import (
    BILD_AUFHEBEN_SEKUNDEN,
    BILD_MAX_BYTES,
    BILD_ORDNER,
    BILD_TYPEN,
    BILD_URL,
    DOMAIN,
    EDITOR_ICON,
    EDITOR_TITLE,
    EDITOR_URL,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL,
    SIGNAL_UPDATED,
    STATIC_URL,
    STORAGE_KEY,
    STORAGE_VERSION,
    YAML_IMPORT,
)

_LOGGER = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent / "frontend"
BILD_NAME = re.compile(r"plan-[0-9a-f]{16}\.(jpg|png|webp)")

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Einmal pro Start: Dateien ausliefern, Bild-Schnittstelle und Websocket-Befehle anmelden."""
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL, str(FRONTEND_DIR), cache_headers=False)]
    )
    ordner = Path(hass.config.path(BILD_ORDNER))
    hass.http.register_view(BildHochladenView(hass, ordner))
    hass.http.register_view(BildView(hass, ordner))
    for command in (ws_subscribe, ws_get, ws_save, ws_yaml_parse, ws_yaml_dump):
        websocket_api.async_register_command(hass, command)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    data = await store.async_load()
    if data is None:
        data = {"config": await hass.async_add_executor_job(_import_yaml, hass)}
        await store.async_save(data)

    # Dateidatum als ?v=, damit Browser und iOS-App nach einem Update die neue Datei laden
    versions = await hass.async_add_executor_job(_file_versions)

    def url(name: str) -> str:
        return f"{STATIC_URL}/{name}?v={versions.get(name, 0)}"

    panels: list[str] = []
    try:
        await panel_custom.async_register_panel(
            hass,
            frontend_url_path=PANEL_URL,
            webcomponent_name="multisite-panel",
            sidebar_title=PANEL_TITLE,
            sidebar_icon=PANEL_ICON,
            module_url=url("multisite-panel.js"),
            config={"speicher": True, "editor": f"/{EDITOR_URL}"},
            require_admin=False,
            # Die App berücksichtigt Notch und Home-Leiste selbst; ohne das polstert HA (ab 2026.8) doppelt
            handle_safe_area=True,
        )
        panels.append(PANEL_URL)
    except ValueError:
        _LOGGER.error(
            "Die Adresse /%s ist schon belegt. Steht das Panel noch als panel_custom in der "
            "YAML-Konfiguration (art_configs/multisite_panel.yaml)? Dort entfernen und neu starten.",
            PANEL_URL,
        )
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=EDITOR_URL,
        webcomponent_name="multisite-editor",
        sidebar_title=EDITOR_TITLE,
        sidebar_icon=EDITOR_ICON,
        module_url=url("multisite-editor.js"),
        config={"panel_modul": url("multisite-panel.js"), "app": f"/{PANEL_URL}"},
        require_admin=True,
    )
    panels.append(EDITOR_URL)

    # Die Startseiten-Karte custom:multisite-start, ohne dass man eine Ressource anlegen muss
    start_js = url("multisite-start.js")
    frontend.add_extra_js_url(hass, start_js)

    hass.data[DOMAIN] = {
        "store": store,
        "config": data.get("config") or {},
        "panels": panels,
        "start_js": start_js,
    }
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    data = hass.data.pop(DOMAIN, None)
    if data:
        for url_path in data["panels"]:
            frontend.async_remove_panel(hass, url_path)
        frontend.remove_extra_js_url(hass, data["start_js"])
    return True


def _file_versions() -> dict[str, int]:
    return {p.name: int(p.stat().st_mtime) for p in FRONTEND_DIR.glob("*.js")}


def _import_yaml(hass: HomeAssistant) -> dict[str, Any]:
    """Übernimmt die bisherige YAML-Datei, falls es sie gibt."""
    for rel in YAML_IMPORT:
        path = Path(hass.config.path(rel))
        if not path.is_file():
            continue
        try:
            config = yaml.safe_load(path.read_text(encoding="utf-8"))
        except (OSError, yaml.YAMLError) as err:
            _LOGGER.warning("%s konnte nicht übernommen werden: %s", path, err)
            continue
        if isinstance(config, dict):
            _LOGGER.info("Konfiguration aus %s übernommen", path)
            return config
    return {}


class BildHochladenView(HomeAssistantView):
    """Nimmt ein Bild für einen Lageplan entgegen (nur Admins, Bild roh im Body)."""

    url = BILD_URL
    name = "api:multisite_panel:bild:hochladen"
    requires_auth = True

    def __init__(self, hass: HomeAssistant, ordner: Path) -> None:
        self.hass = hass
        self.ordner = ordner

    async def post(self, request: web.Request) -> web.Response:
        user = request.get("hass_user")
        if user is None or not user.is_admin:
            return self.json_message("Nur Admins dürfen Bilder hochladen.", HTTPStatus.FORBIDDEN)
        endung = BILD_TYPEN.get(request.content_type)
        if endung is None:
            return self.json_message("Nur JPG, PNG oder WebP.", HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
        # Gestreamt lesen, damit die allgemeine Grenze von 16 MB für Anfragen nicht greift
        daten = bytearray()
        async for stueck in request.content.iter_chunked(1 << 16):
            daten.extend(stueck)
            if len(daten) > BILD_MAX_BYTES:
                return self.json_message("Das Bild ist größer als 40 MB.", HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
        if not daten:
            return self.json_message("Leere Datei.", HTTPStatus.BAD_REQUEST)
        datei = f"plan-{hashlib.sha256(daten).hexdigest()[:16]}.{endung}"
        await self.hass.async_add_executor_job(_bild_schreiben, self.ordner / datei, bytes(daten))
        return self.json({"datei": datei, "bytes": len(daten)})


class BildView(HomeAssistantView):
    """Liefert ein Lageplan-Bild an angemeldete Benutzer (für <img> mit signierter Adresse)."""

    url = BILD_URL + "/{datei}"
    name = "api:multisite_panel:bild"
    requires_auth = True

    def __init__(self, hass: HomeAssistant, ordner: Path) -> None:
        self.hass = hass
        self.ordner = ordner

    async def get(self, request: web.Request, datei: str) -> web.StreamResponse:
        pfad = self.ordner / datei
        if not BILD_NAME.fullmatch(datei) or not await self.hass.async_add_executor_job(pfad.is_file):
            return web.Response(status=HTTPStatus.NOT_FOUND)
        # Der Name enthält den Inhalt als Prüfsumme, die Datei ändert sich also nie
        return web.FileResponse(pfad, headers={"Cache-Control": "private, max-age=31536000, immutable"})


def _bild_schreiben(pfad: Path, daten: bytes) -> None:
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_bytes(daten)


def _bilder_aufraeumen(ordner: Path, config: dict[str, Any]) -> None:
    """Löscht Bilder, die kein Lageplan mehr verwendet und die älter als einen Tag sind."""
    if not ordner.is_dir():
        return
    plaene = config.get("plaene") if isinstance(config.get("plaene"), list) else []
    benutzt = {str(p.get("bild")) for p in plaene if isinstance(p, dict)}
    grenze = time.time() - BILD_AUFHEBEN_SEKUNDEN
    for pfad in ordner.iterdir():
        if BILD_NAME.fullmatch(pfad.name) and pfad.name not in benutzt and pfad.stat().st_mtime < grenze:
            pfad.unlink(missing_ok=True)


def _loaded(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> dict | None:
    data = hass.data.get(DOMAIN)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Das Multi-Site Panel ist nicht eingerichtet.")
    return data


@websocket_api.websocket_command({vol.Required("type"): "multisite_panel/subscribe"})
@callback
def ws_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """Schickt die Konfiguration sofort und danach bei jeder Änderung (für alle Benutzer)."""
    if (data := _loaded(hass, connection, msg)) is None:
        return

    @callback
    def forward(config: dict[str, Any]) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {"config": config}))

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(hass, SIGNAL_UPDATED, forward)
    connection.send_result(msg["id"])
    forward(data["config"])


@websocket_api.require_admin
@websocket_api.websocket_command({vol.Required("type"): "multisite_panel/config/get"})
@callback
def ws_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if (data := _loaded(hass, connection, msg)) is None:
        return
    connection.send_result(msg["id"], {"config": data["config"]})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "multisite_panel/config/save", vol.Required("config"): dict}
)
@websocket_api.async_response
async def ws_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    if (data := _loaded(hass, connection, msg)) is None:
        return
    config = msg["config"]
    await data["store"].async_save({"config": config})
    data["config"] = config
    async_dispatcher_send(hass, SIGNAL_UPDATED, config)
    connection.send_result(msg["id"])
    await hass.async_add_executor_job(_bilder_aufraeumen, Path(hass.config.path(BILD_ORDNER)), config)


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "multisite_panel/yaml/parse", vol.Required("yaml"): str}
)
@websocket_api.async_response
async def ws_yaml_parse(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    """YAML-Text aus dem Editor in eine Konfiguration umwandeln."""
    try:
        config = await hass.async_add_executor_job(yaml.safe_load, msg["yaml"])
    except yaml.YAMLError as err:
        connection.send_error(msg["id"], "invalid_yaml", str(err))
        return
    if config is None:
        config = {}
    if not isinstance(config, dict):
        connection.send_error(
            msg["id"], "invalid_yaml", "Ganz oben müssen Schlüssel stehen, z. B. standorte:"
        )
        return
    connection.send_result(msg["id"], {"config": config})


@websocket_api.require_admin
@websocket_api.websocket_command(
    {vol.Required("type"): "multisite_panel/yaml/dump", vol.Required("config"): dict}
)
@websocket_api.async_response
async def ws_yaml_dump(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    text = await hass.async_add_executor_job(yaml_dump, msg["config"])
    connection.send_result(msg["id"], {"yaml": text})
