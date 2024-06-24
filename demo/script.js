import COSHP from '../index.js';
const coshp = new COSHP('test/tracts-ordered');

var map = L.map('map').setView([42.358, -71.0545], 16);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const geojsonLayer = L.geoJSON().addTo(map);
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