/*
 * Startseiten-Karte custom:multisite-start: leitet beim Öffnen der App einmal ins Multi-Site Panel weiter,
 * weil Home Assistant eigene Panels nicht als Startseite anbietet. Die Integration lädt diese Datei auf
 * jeder Seite mit, eine Dashboard-Ressource ist nicht nötig.
 */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

class MultisiteStart extends HTMLElement {
  setConfig(c){ this._ziel = (c && c.ziel) || '/zuhause'; this._render(); }
  set hass(h){ this._hass = h; if (!this._tried){ this._tried = true; setTimeout(() => this._go(), 0); } }
  connectedCallback(){ this._render(); }
  getCardSize(){ return 1; }
  _go(){
    const params = new URLSearchParams(location.search);
    if (window.__multisiteRedirected || params.has('bleiben') || params.has('edit') || this.editMode || this.preview || this.closest && this.closest('hui-card-preview')) return;
    window.__multisiteRedirected = true;
    history.replaceState(null, '', this._ziel || '/zuhause');
    window.dispatchEvent(new CustomEvent('location-changed', {detail: {replace: true}}));
  }
  _render(){
    const ziel = esc(this._ziel || '/zuhause');
    this.innerHTML = `<ha-card style="padding:16px;line-height:1.5">Beim Öffnen der App geht es automatisch weiter zu <a href="${ziel}">${ziel}</a>. Um dieses Dashboard zu bearbeiten, hänge <code>?bleiben</code> an die Adresse.</ha-card>`;
  }
}

if (!customElements.get('multisite-start')){
  customElements.define('multisite-start', MultisiteStart);
  window.customCards = window.customCards || [];
  window.customCards.push({type: 'multisite-start', name: 'Multi-Site Start', description: 'Leitet beim Öffnen der App einmal ins Multi-Site Panel weiter.'});
}
