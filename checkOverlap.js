export default (a, b) => {
    if (b[0] > a[2] || a[0] > b[2]) {
        return false;
    }
    if (b[1] > a[3] || a[1] > b[3]) {
        return false;
    }
    return true;
}