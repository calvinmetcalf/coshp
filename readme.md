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

import directly into script:

```js
import Coshp from 'https://unpkg.com/coshp@latest/coshp.js`
```

Bounding box should be in the same projection as your file is in, the result is always in WGS84.

You can as a 2nd parameter pass in an options object possible options are

 - `blocksize`: We always read the `.qix` file in chunks of this size. It currently defaults to 4KiB but it may be changed in the future. 
 - `gap`: defaults to zero.  We use this when consoldating the ids we got from the qix query, by default we will combine adjasent ids into ranges (so 2,3,4,6,7,10 turns into 2-4, 6-7, 10).  By increasing it coshp will combine runs that include a gap so if `gap` was set to 1 then the aforemention example would consolidate into 2-7, 10, if you set `gap` to 2 it would consolidate into 2-10. The extra will be downloaded but filtered out later in the process. Helps if you want to minimize the number of web requests you make.

## Command line tools

to add a `.qix` index file you can run the following command

### Build

```bash
npx coshp build ./path/to/shape.shp
```

optionally you can choose between the bottomup algorithm (default), topdown, hybrid or hilbertquad one with the `-a` flag.  But you shouldn't because the origional one is best

you can also change the number of nodes per leval (Default 4) with the `-n` option and the number of shapes in the leaf nodes (Default 8) with the `-l` flag.  Change the leaf size if you want more compact leaves to avoid downloading excess nodes.

Lastly you can use the `-s` or `-p` flag to try either Swaping shapes between nodes or Promoting shapes that cover more than 60% of a node higher up the tree.  Neither of these things seem to be good ideas.

### Reorder

Then to reorder your shapefile to be queryable via the `.qix` file run

```bash
npx coshp reorder  ./path/to/shape.shp
```

and it will output the reordered file at `./path/to/shape-ordered.shp`

you can use the `-s` flag to change the suffix to something besides `ordered`

## questions

### does it work? 

YES!

### why? 

I was doing research for a talk and Paul Ramsey [nerd sniped](https://xkcd.com/356/) me with [this blog post](http://blog.cleverelephant.ca/2022/04/coshp.html).

### is this a good idea?

probably not

### can I see how the qix index works?

yes go check out this [demo](https://calvinmetcalf.github.io/coshp/qix-demo.html)

### why doesn't it work on firefox

See [this bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1874840).

## Versions

# 2.0.0

Version 2.0.0 corrects enough bugs in how .qix files are generated and handled that if you happened to actually be using this in production (you should not) I'd consider it a breaking change.  The upside is that it's totally compatible with mapsever now.  Changes include

- correctly calculating `.qix` sibling node offsets, the .qix documentation had a bug implying they were calculated from the end of the mandatory part of the node, they are actually calculated from the end of the node.
- zero indexing all ids in the .qix files, shp files are technically 1 indexed but since record ids are usually inferred from position the actual id values are rarely dealt with.
- did you know there is a random byte between the header and the rest of the file in `.dbf` file? Yeah neither did I but it's now included in the `.dbf` files created when reordering your files with this tool.
- fixed a bug where we were accidentally not grabbing the last record of any range we queried
- `.qix` files are now loaded incrementally in user specified blocks defaulting to 4kb.
- downloading rows from the remote `.shp` and `.dbf` file is now parallelized up to a limit.

# 2.0.1

Small bug fix as I didn't publish 2.0.0 quite right

# 2.0.2

Change the main file name so that you can easily import coshp directly. 

# 2.1.0

a bunch of small changes I realized while writing a talk about this, also we now have some more options.

# 2.2.0

more comand line options, more regular options, tamed all the weird and wild thing I was trying.