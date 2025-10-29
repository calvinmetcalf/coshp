
import HttpReader from '../src/HttpReader.js'
import {EagerQix} from '../src/parseQix.js'
import COSHP from '../coshp.js';
const filepath = (new URLSearchParams(location.search)).get('file') || 'blockgroups-ordered';

const qix = new EagerQix(new HttpReader('test/data/' + filepath));
const coshp = new COSHP('test/data/' + filepath)
await qix.init();

const features = [];
const geojson = {
    type: 'FeatureCollection',
    features
};
const todo = [qix.tree];
todo[0].id = 'root';
todo[0].parent = null; 
const toGeom = (bbox)=> 
   ( {
        type: 'Polygon',
        coordinates: [[
            [bbox[0], bbox[1]],
            [bbox[2], bbox[1]],
            [bbox[2], bbox[3]],
            [bbox[0], bbox[3]],
            [bbox[0], bbox[1]]
        ]]
    })
while (todo.length) {
    const node = todo.pop();
    // console.log('node', node);
    const out = {
        type: 'Feature',
        geometry: toGeom(node.bbox),
        properties: {
            id: node.id,
            shapeIds: node.ids,
            childIds:[],
            parent: node.parent
        }
    }
    features.push(out);
    if (node.children) {
        out.properties.leaf = false;
        for (const child of node.childNodes) {
            child.parent = node.id;
            out.properties.childIds.push(child.id);
            todo.push(child);
        }
    } else {
        out.properties.leaf = true;
    }
}
var map = L.map('map');
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

let parent = null;
const data = geojson;
const runQueries = async feature => {
    for (const id of feature.properties.shapeIds) {
        const feature = await coshp.getById(id + 1);
        otherGeojson.addData(feature);
    }
}
const geojsonLayer = L.geoJSON({
    type: 'FeatureCollection', features: []
}, {
    style(feature) {
        if (feature.properties.childIds.length) {
            return {};
        }
        return {
            fillOpacity: 0
        }
    },
   onEachFeature(feature, layer) {
    // console.log(feature, layer)
    if (feature.properties.childIds.length) {
        layer.on('click', (e)=>{
            // e.preventDefault();
            parent = feature.properties.id;
            setVisable();
            otherGeojson.clearLayers();
        })
    } else {
        layer.on('click', (e)=>{
             otherGeojson.clearLayers();
            runQueries(feature).catch(e=>console.error(e));
            geojsonLayer.resetStyle();
            console.log('parent', layer.getBounds().toBBoxString())
            layer.setStyle({
                  fillOpacity: 0,
                  color: '#0f0'
            })
        });
    }
    if (feature.properties.parent) {
        layer.on('contextmenu', ()=>{
            otherGeojson.clearLayers();
            const parentNode = data.features.find((feature)=>feature.properties.id === parent);
            parent = parentNode.properties.parent;
            setVisable();
        })
    }
}
}).addTo(map);
const otherGeojson  = L.geoJSON({
    type: 'FeatureCollection', features: []
}, {onEachFeature(feature, layer) {
    layer.bindPopup(`bounds: ${layer.getBounds().toBBoxString()}`)
}}).addTo(map);
window.geojsonLayer = geojsonLayer
// map.on('movestart zoomstart', () => {
//     geojsonLayer.clearLayers();
// });
const setVisable = () => {
   geojsonLayer.clearLayers();
   for (const feature of data.features) {
    if (feature.properties.parent === parent) {
        geojsonLayer.addData(feature);
    }
   }
}
setVisable();
map.fitBounds(geojsonLayer.getBounds());