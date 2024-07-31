# cloud optimized shapefile

A library to optimize shapefiles to the cloud and then query them remotely via HTTP, like how cloud optimized geotiffs allow this for imagery. Provides tools to generate `.qix` geoindex files, sort shapefiles geographically based on their order in the `.qix` file, and query shapefiles remotely by bounding box. Based on the idea from [Paul Ramsey](http://blog.cleverelephant.ca/2022/04/coshp.html).

Geoindexing algorithm based on [flatbush by Volodymyr Agafonkin](https://github.com/mourner/flatbush).

## API

install via npm

```bash
npm install coshp
```

```js
const coshp = new Coshp('https://example.biz/path/to/shapfile.shp');
const geojson = coshp.query([xmin, ymin, xmax, ymax]);
```

Bounding box should be in the same projection as your file is in, the result is always in WGS84.

You can as a 2nd parameter pass in a block size for the `.qix` file. It currently defaults to 4KiB but it may be changed in the future.

## Command line tools

to add a `.qix` index file you can run the following command

```bash
npx coshp build ./path/to/shape.shp
```

then to reorder your shapefile to be queryable via the `.qix` file run

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

## Versions

# 2.0.0

Version 2.0.0 corrects enough bugs in how .qix files are generated and handled that if you happened to actually be using this in production (you should not) I'd consider it a breaking change.  The upside is that it's totally compatible with mapsever now.  Changes include

- correctly calculating `.qix` sibling node offsets, the .qix documentation had a bug implying they were calculated from the end of the mandatory part of the node, they are actually calculated from the end of the node.
- zero indexing all ids in the .qix files, shp files are technically 1 indexed but since record ids are usually inferred from position the actual id values are rarely dealt with.
- did you know there is a random byte between the header and the rest of the file in `.dbf` file? Yeah neither did I but it's now included in the `.dbf` files created when reordering your files with this tool.
- fixed a bug where we were accidentally not grabbing the last record of any range we queried
- `.qix` files are now loaded incrementally in user specified blocks defaulting to 4kb.
- downloading rows from the remote `.shp` and `.dbf` file is now parallelized up to a limit.

