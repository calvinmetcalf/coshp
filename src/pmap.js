

export default async (arr, fn, max = 6) => {
    const out = new Array(arr.length);
    const proms = new Set();
    let i = -1;
    for (const thing of arr) {
        i++;
        if (proms.size >= max) {
            await Promise.race(Array.from(proms));
        }
        const prom = fn(thing);
        proms.add(prom);
        prom.then(item => {
            out.push(item);
            proms.delete(prom);
        })
    }
    await Promise.all(Array.from(proms));
    return out;
}