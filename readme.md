# cloud optimized shapefile

A library to query shapefiles that have been sorted geographically via a `.qix` file, based on the idea from [Paul Ramsey](http://blog.cleverelephant.ca/2022/04/coshp.html).

## API

install via npm

```bash
npm insall coshp
```

```js
const coshp = new Coshp('https://example.biz/path/to/shapfile.shp');
const geojson = coshp.query([xmin, ymin, xmax, ymax]);
```

## Command line tools

to add a `.qix` index file you can run the following command

```bash
npx coshp build ./path/to/shape.shp
```

then to reorder your shapefile to  be queriable via the `.qix` file run

```bash
npx coshp reorder  ./path/to/shape.shp
```

and it will output the reordered file at `./path/to/shape-ordered.shp`

## questions

### does it work? 

Probably

### why? 

I was doing research for a talk and [Paul Ramsey](http://blog.cleverelephant.ca/2022/04/coshp.html) nerd sniped me.

### is this a good idea?

probably not
