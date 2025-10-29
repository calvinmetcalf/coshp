import COSHP from '../coshp.js'
import FileReader from '../src/FileReader.js'
import makeBBOX from './random-bbox.js'
const makeCoshp = (path, arg) => {
  return new COSHP(new FileReader(`${import.meta.dirname}/data/${path}`, true), arg)
}

class Thing {
    constructor(path, name, gap) {
        this.name = name;
        this.file = makeCoshp(path, {gap});
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
        const out = {
            ranges: this.calls,
            waste: ((this.filtered/(this.returned + this.filtered)) * 100).toFixed(2) + ' %'
        }
        // console.log(`${this.name}: ${this.calls} ranges`)
        // // console.log(`${this.name}: ${this.filtered} filtered`)
        // console.log(`${this.name}: ${((this.filtered/(this.returned + this.filtered)) * 100).toFixed(2)} % waste`);
        let totalCalls = 0;
        let totalSize = 0;
        for (const [type, {calls, size}] of this.file.reader.stats) {
            totalCalls += calls;
            totalSize += size;
            //   console.log(`${this.name}: ${type} ${calls} calls`);
            //    console.log(`${this.name}: ${type} ${size.toLocaleString()} dataread`);
        }
        out.calls = totalCalls;
        out.downloaded = (totalSize/(1024 * 1024)).toFixed(2);
        // console.log(`${this.name}: ${totalCalls} calls`);
        // console.log(`${this.name}: ${totalSize.toLocaleString()} total downloaded`);
        // out.callMultiplier = (out.calls / out.ranges).toFixed(2)
        return out;
    }
}

const tests = [
    new Thing('blockgroups-mapserver-ordered', 'geoserver'),
        new Thing('blockgroups-mapserver-ordered', 'geoserver-gap', 10),
    new Thing('blockgroups-ordered-topdown', 'topdown'),
     new Thing('blockgroups-ordered-topdown', 'topdown-gap', 10),


    new Thing('blockgroups-hybrid', 'hybrid'),
        new Thing('blockgroups-hybrid', 'hybrid-gap', 10),

     new Thing('blockgroups-hilbertquad', 'hilbert-quadtree'),
      new Thing('blockgroups-hilbertquad', 'hilbert-quadtree-gap', 10),
    new Thing('blockgroups-ordered', 'bottomup'),
      new Thing('blockgroups-ordered', 'bottomup-gap', 10),
          new Thing('blockgroups-swap', 'bottomup-swap'),
      new Thing('blockgroups-swap', 'bottomup-swap-gap', 10),
                new Thing('blockgroups-promote', 'bottomup-promote'),
      new Thing('blockgroups-promote', 'bottomup-promote-gap', 10),
          new Thing('blockgroups-bottomup-4l', 'bottomup 4l'),
      new Thing('blockgroups-bottomup-4l', 'bottomup 4l-gap', 10),
    new Thing('blockgroups', 'unordered'),
     new Thing('blockgroups', 'unordered-gap', 10)
]

const testAll = async (bbox) => {
    await Promise.all(tests.map(thing=>thing.query(bbox)));
}
const reportAll = () => {
    const out = {};
    tests.forEach(item=>{
        out[item.name] = item.report()
    });
    console.table(out);
}

let i = 15;
while (--i) {
    await testAll(makeBBOX())
}
reportAll();