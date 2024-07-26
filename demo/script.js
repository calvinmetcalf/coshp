import COSHP from '../src/index.js';
const coshp = new COSHP('test/data/blockgroups-ordered', 'block');

var map = L.map('map', {
    minZoom: 14
}).setView([42.358, -71.0545], 16);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const geojsonLayer = L.geoJSON({
    type: 'FeatureCollection', features: []
}, {
    onEachFeature(feature, layer) {
        // does this feature have a property named popupContent?
        if (feature.properties) {
            layer.bindPopup(`${feature.id}`);
        }
    }
}).addTo(map);
// map.on('movestart zoomstart', () => {
//     geojsonLayer.clearLayers();
// });

const getShps = async () => {
    geojsonLayer.clearLayers();
    // maybe some sort of spinner
    const bounds = map.getBounds().toBBoxString().split(',');
    const shps = await coshp.query(bounds);
    console.log('shps', shps)
    geojsonLayer.addData(shps)
}
// map.on('moveend zoomend', getShps);
getShps().then(() => {
    console.log('loaded')
})
var info = L.control();

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
    this._div.innerHTML = '<button id="clicker">Click to rerun query</button>';
    return this._div;
};

info.addTo(map);
const button = L.DomUtil.get('clicker');
button.addEventListener('click', async () => {
    await getShps();
})