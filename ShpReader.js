

function isClockWise(array) {
    let sum = 0;
    let i = 1;
    const len = array.length;
    let prev, cur;
    const bbox = [array[0][0], array[0][1], array[0][0], array[0][1]];
    while (i < len) {
        prev = cur || array[0];
        cur = array[i];
        sum += ((cur[0] - prev[0]) * (cur[1] + prev[1]));
        i++;
        if (cur[0] < bbox[0]) {
            bbox[0] = cur[0];
        }
        if (cur[1] < bbox[1]) {
            bbox[1] = cur[1];
        }
        if (cur[0] > bbox[2]) {
            bbox[2] = cur[0];
        }
        if (cur[1] > bbox[3]) {
            bbox[3] = cur[1];
        }
    }
    return {
        ring: array,
        clockWise: sum > 0,
        bbox,
        children: []
    }

}

function contains(outer, inner) {
    if (outer.bbox[0] > inner.bbox[0]) {
        return false;
    }
    if (outer.bbox[1] > inner.bbox[1]) {
        return false;
    }
    if (outer.bbox[2] < inner.bbox[2]) {
        return false;
    }
    if (outer.bbox[3] < inner.bbox[3]) {
        return false;
    }
    return true;
}

function handleRings(rings) {
    const outers = [];
    const inners = [];
    for (const ring of rings) {
        const proccessed = isClockWise(ring);
        if (proccessed.clockWise) {
            outers.push(proccessed)
        } else {
            inners.push(proccessed)
        }
    }
    // this is an optimization, 
    // but it would also put in weird bad rings that would otherwise get left out
    // if (outers.length === 1) {
    //   const out = [outers[0].ring]
    //   for (const inner of inners) {
    //     out.push(inner.ring);

    //   }
    //   return [out];
    // }
    for (const inner of inners) {
        for (const outer of outers) {
            if (contains(outer, inner)) {
                outer.children.push(inner.ring);
                break;
            }
        }
    }
    const out = [];
    for (const outer of outers) {
        out.push([outer.ring].concat(outer.children));
    }
    return out;
}
function polyReduce(a, b) {
    if (isClockWise(b) || !a.length) {
        a.push([b]);
    } else {
        a[a.length - 1].push(b);
    }
    return a;
}
ParseShp.prototype.parsePoint = function (data) {
    return {
        type: 'Point',
        coordinates: this.parseCoord(data, 0)
    };
};
ParseShp.prototype.parseZPoint = function (data) {
    const pointXY = this.parsePoint(data);
    pointXY.coordinates.push(data.getFloat64(16, true));
    return pointXY;
};
ParseShp.prototype.parsePointArray = function (data, offset, num) {
    const out = [];
    let done = 0;
    while (done < num) {
        out.push(this.parseCoord(data, offset));
        offset += 16;
        done++;
    }
    return out;
};
ParseShp.prototype.parseZPointArray = function (data, zOffset, num, coordinates) {
    let i = 0;
    while (i < num) {
        coordinates[i].push(data.getFloat64(zOffset, true));
        i++;
        zOffset += 8;
    }
    return coordinates;
};
ParseShp.prototype.parseArrayGroup = function (data, offset, partOffset, num, tot) {
    const out = [];
    let done = 0;
    let curNum; let nextNum = 0;
    let pointNumber;
    while (done < num) {
        done++;
        partOffset += 4;
        curNum = nextNum;
        if (done === num) {
            nextNum = tot;
        } else {
            nextNum = data.getInt32(partOffset, true);
        }
        pointNumber = nextNum - curNum;
        if (!pointNumber) {
            continue;
        }
        out.push(this.parsePointArray(data, offset, pointNumber));
        offset += (pointNumber << 4);
    }
    return out;
};
ParseShp.prototype.parseZArrayGroup = function (data, zOffset, num, coordinates) {
    let i = 0;
    while (i < num) {
        coordinates[i] = this.parseZPointArray(data, zOffset, coordinates[i].length, coordinates[i]);
        zOffset += (coordinates[i].length << 3);
        i++;
    }
    return coordinates;
};
ParseShp.prototype.parseMultiPoint = function (data) {
    const out = {};
    const num = data.getInt32(32, true);
    if (!num) {
        return null;
    }
    const mins = this.parseCoord(data, 0);
    const maxs = this.parseCoord(data, 16);
    out.bbox = [
        mins[0],
        mins[1],
        maxs[0],
        maxs[1]
    ];
    const offset = 36;
    if (num === 1) {
        out.type = 'Point';
        out.coordinates = this.parseCoord(data, offset);
    } else {
        out.type = 'MultiPoint';
        out.coordinates = this.parsePointArray(data, offset, num);
    }
    return out;
};
ParseShp.prototype.parseZMultiPoint = function (data) {
    const geoJson = this.parseMultiPoint(data);
    if (!geoJson) {
        return null;
    }
    let num;
    if (geoJson.type === 'Point') {
        geoJson.coordinates.push(data.getFloat64(72, true));
        return geoJson;
    } else {
        num = geoJson.coordinates.length;
    }
    const zOffset = 52 + (num << 4);
    geoJson.coordinates = this.parseZPointArray(data, zOffset, num, geoJson.coordinates);
    return geoJson;
};
ParseShp.prototype.parsePolyline = function (data) {
    const out = {};
    const numParts = data.getInt32(32, true);
    if (!numParts) {
        return null;
    }
    const mins = this.parseCoord(data, 0);
    const maxs = this.parseCoord(data, 16);
    out.bbox = [
        mins[0],
        mins[1],
        maxs[0],
        maxs[1]
    ];
    const num = data.getInt32(36, true);
    let offset, partOffset;
    if (numParts === 1) {
        out.type = 'LineString';
        offset = 44;
        out.coordinates = this.parsePointArray(data, offset, num);
    } else {
        out.type = 'MultiLineString';
        offset = 40 + (numParts << 2);
        partOffset = 40;
        out.coordinates = this.parseArrayGroup(data, offset, partOffset, numParts, num);
    }
    return out;
};
ParseShp.prototype.parseZPolyline = function (data) {
    const geoJson = this.parsePolyline(data);
    if (!geoJson) {
        return null;
    }
    const num = geoJson.coordinates.length;
    let zOffset;
    if (geoJson.type === 'LineString') {
        zOffset = 60 + (num << 4);
        geoJson.coordinates = this.parseZPointArray(data, zOffset, num, geoJson.coordinates);
        return geoJson;
    } else {
        const totalPoints = geoJson.coordinates.reduce(function (a, v) {
            return a + v.length;
        }, 0);
        zOffset = 56 + (totalPoints << 4) + (num << 2);
        geoJson.coordinates = this.parseZArrayGroup(data, zOffset, num, geoJson.coordinates);
        return geoJson;
    }
};
ParseShp.prototype.polyFuncs = function (out) {
    if (!out) {
        return out;
    }
    if (out.type === 'LineString') {
        out.type = 'Polygon';
        out.coordinates = [out.coordinates];
        return out;
    } else {
        out.coordinates = handleRings(out.coordinates)
        if (out.coordinates.length === 1) {
            out.type = 'Polygon';
            out.coordinates = out.coordinates[0];
            return out;
        } else {
            out.type = 'MultiPolygon';
            return out;
        }
    }
};
ParseShp.prototype.parsePolygon = function (data) {
    return this.polyFuncs(this.parsePolyline(data));
};
ParseShp.prototype.parseZPolygon = function (data) {
    return this.polyFuncs(this.parseZPolyline(data));
};
const shpFuncObj = {
    1: 'parsePoint',
    3: 'parsePolyline',
    5: 'parsePolygon',
    8: 'parseMultiPoint',
    11: 'parseZPoint',
    13: 'parseZPolyline',
    15: 'parseZPolygon',
    18: 'parseZMultiPoint'
};

function makeParseCoord(trans) {
    if (trans) {
        return function (data, offset) {
            const args = [data.getFloat64(offset, true), data.getFloat64(offset + 8, true)];
            return trans.inverse(args);
        };
    } else {
        return function (data, offset) {
            return [data.getFloat64(offset, true), data.getFloat64(offset + 8, true)];
        };
    }
}

export default function ParseShp(header, trans) {
    this.headers = this.parseHeader(header);
    this.shpFuncs();
    this.parseCoord = makeParseCoord(trans);
}
ParseShp.prototype.shpFuncs = function (tran) {
    let num = this.headers.shpCode;
    if (num > 20) {
        num -= 20;
    }
    if (!(num in shpFuncObj)) {
        throw new Error('I don\'t know that shp type');
    }
    this.parseFunc = this[shpFuncObj[num]];
};
ParseShp.prototype.parseHeader = function (view) {
    return {
        length: view.getInt32(6 << 2) << 1,
        version: view.getInt32(7 << 2, true),
        shpCode: view.getInt32(8 << 2, true),
        bbox: [
            view.getFloat64(9 << 2, true),
            view.getFloat64(11 << 2, true),
            view.getFloat64(13 << 2, true),
            view.getFloat64(15 << 2, true)
        ]
    };
};
ParseShp.prototype.getRow = function (view) {
    const len = view.byteLength;
    if (len === 0) {
        return null;
    }
    const type = view.getInt32(0, true);
    if (!type) {
        return null;
    }
    const newView = new DataView(view.buffer, view.byteOffset + 4, view.byteLength - 4);
    return this.parseFunc(newView);
};
