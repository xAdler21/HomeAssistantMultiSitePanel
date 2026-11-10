// Lokale Vorschau: lädt das Panel mit nachgebautem hass-Objekt.
// ?dunkel bzw. ?hell an die Adresse hängen, um das Farbschema zu erzwingen.
// ?speicher: Konfiguration wie mit der Integration über den (nachgebauten) Websocket; Änderungen aus
// dev/editor.html im selben Browser kommen dann live an.
// Daten: privat/vorschau-daten.js, wenn vorhanden, sonst das erfundene Beispiel dev/demo-daten.js.
import './ha-icon.js';
import '../custom_components/multisite_panel/frontend/multisite-panel.js';
import {createMockHass, ladeDaten} from './mock-hass.js';

const daten = await ladeDaten();
const panel = document.getElementById('panel');
const speicher = new URLSearchParams(location.search).has('speicher');
panel.panel = {url_path: 'zuhause', config: speicher ? {speicher: true, editor: '/dev/editor.html'} : daten.mockConfig};
panel.narrow = window.innerWidth < 870;
panel.hass = createMockHass(daten, h => { panel.hass = h; });
window.addEventListener('resize', () => { panel.narrow = window.innerWidth < 870; });
window.addEventListener('hass-more-info', ev => console.info('[mock] More-Info für', ev.detail.entityId));
window.addEventListener('hass-toggle-menu', () => console.info('[mock] Menü öffnen'));
// Navigation per history.pushState (z. B. „Bearbeiten“) als echten Seitenwechsel ausführen
window.addEventListener('location-changed', () => { if (location.pathname !== '/dev/vorschau.html') location.reload(); });
