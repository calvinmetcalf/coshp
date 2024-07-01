# cloud optimized shapefile

A library to optimize shapefiles to the cloud and then query them remotely via HTTP, like how cloud optimized geotiffs allow this for imagery. Provides tools to generate `.qix` geoindex files, sort shapefies geographically based on their order in the `.qix` file, and query shapefiles remotely by bounding box. Based on the idea from [Paul Ramsey](http://blog.cleverelephant.ca/2022/04/coshp.html).

Geoindexing algorithm based on [flatbush by Volodymyr Agafonkin](https://github.com/mourner/flatbush).

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

YES!

### why? 

I was doing research for a talk and Paul Ramsey [nerd sniped](https://xkcd.com/356/) me with [this blog post](http://blog.cleverelephant.ca/2022/04/coshp.html).

### is this a good idea?

probably not


## todo

- partial loading of `.qix` files