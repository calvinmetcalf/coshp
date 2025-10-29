export const consolidateIds = (ids, gap = 0) => {
    gap++;
    ids.sort((a, b) => a - b);
    const out = [];
    let prev;
    ids = ids.map(item => item + 1)
    let i = -1;
    while (++i < ids.length) {
        const cur = ids[i];
        if (!prev) {
            prev = {
                type: 'single',
                id: cur
            }
            continue;
        }
        if (prev.type === 'single') {
            if (prev.id + gap >= cur) {
                prev = {
                    type: 'range',
                    start: prev.id,
                    end: cur
                }
            } else {
                out.push(prev);
                prev = {
                    type: 'single',
                    id: cur
                }
            }
            continue;
        }
        if (prev.type === 'range') {
            if (prev.end + gap >= cur) {
                prev.end = cur;
            } else {
                out.push(prev);
                prev = {
                    type: 'single',
                    id: cur
                }
            }
        }
    }
    out.push(prev);
    return out;
}