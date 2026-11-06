"""Einrichtung über Einstellungen → Geräte & Dienste."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult

from .const import DOMAIN


class MultisitePanelConfigFlow(ConfigFlow, domain=DOMAIN):
    """Ein Schritt ohne Eingaben; mehr als ein Eintrag ist per Manifest ausgeschlossen."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title="Multi-Site Panel", data={})
        return self.async_show_form(step_id="user")
