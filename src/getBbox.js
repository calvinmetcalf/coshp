const updateBbox = (old, nw) => {
    if (nw[0] < old[0]) {
        old[0] = nw[0]
    }
    if (nw[1] < old[1]) {
        old[1] = nw[1]
    }
    if (nw[0] > old[2]) {
        old[2] = nw[0]
    }
    if (nw[1] > old[3]) {
        old[3] = nw[1]
    }
}
const iterateArr = (arr, bbox) => {
    for (const item of arr) {
        if (Array.isArray(item[0])) {
            iterateArr(item, bbox);
        } else {
            updateBbox(bbox, item);
        }
    }
}
export default (arr)=> {
    if (typeof arr[0] === 'number') {
        return [arr[0], arr[1], arr[0], arr[1]];
    }

    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
   iterateArr(arr, bbox);
//    console.log('bbox', bbox)
   return bbox;
}