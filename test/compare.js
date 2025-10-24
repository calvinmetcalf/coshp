import COSHP from '../coshp.js'
import FileReader from '../src/FileReader.js'
import {randomPosition} from '@turf/random'
const makeCoshp = (path, arg) => {
  return new COSHP(new FileReader(`${import.meta.dirname}/data/${path}`, true), arg)
}

const maBounds = [
    -73.50821046061365,
    41.18705440018156,
    -69.85886099999999,
    42.88677831582657
  ];
  const makeBBOX = ()=>{
    const p1 = randomPosition(maBounds);
    const p2 = randomPosition(maBounds);
    return [
        Math.min(p1[0], p2[0]),
        Math.min(p1[1], p2[1]),
        Math.max(p1[0], p2[0]),
        Math.max(p1[1], p2[1])
    ]
  }

const geoserver = makeCoshp('blockgroups-mapserver-ordered');
const topdown = makeCoshp('blockgroups-ordered-topdown');
const bottomup = makeCoshp('blockgroups-ordered');
const unordered = makeCoshp('blockgroups');
class Thing {
    constructor(path, name) {
        this.name = name;
        this.file = makeCoshp(path);
        this.filtered = 0;
        this.calls = 0;
        this.returned = 0;
    }
    async query(bbox) {
        const out = await this.file.query(bbox, true);
        this.filtered += out.filtered;
        this.calls += out.calls;
        this.returned +=  out.features.length;
    }
    report() {
        console.log(`${this.name}: ${this.calls} ranges`)
        console.log(`${this.name}: ${this.filtered} filtered`)
        console.log(`${this.name}: ${((this.filtered/(this.returned + this.filtered)) * 100).toFixed(2)} % waste`);
        let totalCalls = 0;
        let totalSize = 0;
        for (const [type, {calls, size}] of this.file.reader.stats) {
            totalCalls += calls;
            totalSize += size;
              console.log(`${this.name}: ${type} ${calls} calls`);
               console.log(`${this.name}: ${type} ${size.toLocaleString()} dataread`);
        }
        console.log(`${this.name}: ${totalCalls} calls`);
        console.log(`${this.name}: ${totalSize.toLocaleString()} total downloaded`)
    }
}

const tests = [
    new Thing('blockgroups-mapserver-ordered', 'geoserver'),
    new Thing('blockgroups-ordered-topdown', 'topdown'),
    new Thing('blockgroups-ordered', 'bottomup'),
    new Thing('blockgroups-ordered-old', 'old bottomup'),
    new Thing('blockgroups', 'unordered')
]

const testAll = async (bbox) => {
    await Promise.all(tests.map(thing=>thing.query(bbox)));
}
const reportAll = () => {
    tests.forEach(item=>item.report())
}

let i = 15;
while (--i) {
    await testAll(makeBBOX())
}
reportAll();