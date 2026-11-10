// Lokale Vorschau des Editors mit nachgebautem hass-Objekt und Speicher.
// Gespeichertes landet im localStorage und kommt in dev/vorschau.html?speicher live an.
// ?zuruecksetzen stellt die Beispielkonfiguration wieder her. Hochgeladene Bilder gibt es nur bis zum Neuladen.
// Daten: privat/vorschau-daten.js, wenn vorhanden, sonst das erfundene Beispiel dev/demo-daten.js.
import './ha-icon.js';
import '../custom_components/multisite_panel/frontend/multisite-panel.js';
import '../custom_components/multisite_panel/frontend/multisite-editor.js';
import {createMockHass, ladeDaten} from './mock-hass.js';

const daten = await ladeDaten();
const editor = document.getElementById('editor');
editor.panel = {url_path: 'zuhause-editor', config: {app: '/dev/vorschau.html?speicher'}};
editor.narrow = window.innerWidth < 870;
editor.hass = createMockHass(daten, h => { editor.hass = h; });
window.addEventListener('resize', () => { editor.narrow = window.innerWidth < 870; });
window.addEventListener('hass-more-info', ev => console.info('[mock] More-Info für', ev.detail.entityId));
window.addEventListener('hass-toggle-menu', () => console.info('[mock] Menü öffnen'));
window.addEventListener('location-changed', () => { if (location.pathname !== '/dev/editor.html') location.reload(); });
