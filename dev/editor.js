// Lokale Vorschau des Editors mit nachgebautem hass-Objekt und Speicher.
// Gespeichertes landet im localStorage und kommt in dev/vorschau.html?speicher live an.
// ?zuruecksetzen stellt die Beispielkonfiguration wieder her.
import './ha-icon.js';
import '../custom_components/multisite_panel/frontend/multisite-panel.js';
import '../custom_components/multisite_panel/frontend/multisite-editor.js';
import {createMockHass} from './mock-hass.js';

const editor = document.getElementById('editor');
editor.panel = {url_path: 'zuhause-editor', config: {app: '/dev/vorschau.html?speicher'}};
editor.narrow = window.innerWidth < 870;
editor.hass = createMockHass(h => { editor.hass = h; });
window.addEventListener('resize', () => { editor.narrow = window.innerWidth < 870; });
window.addEventListener('hass-more-info', ev => console.info('[mock] More-Info für', ev.detail.entityId));
window.addEventListener('hass-toggle-menu', () => console.info('[mock] Menü öffnen'));
window.addEventListener('location-changed', () => { if (location.pathname !== '/dev/editor.html') location.reload(); });
