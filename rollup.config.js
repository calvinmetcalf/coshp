import { nodeResolve } from '@rollup/plugin-node-resolve';
import nodePolyfills from 'rollup-plugin-node-polyfills';
import commonjs from '@rollup/plugin-commonjs';
export default ({
    input: 'include/proj4.js',
    plugins: [
        nodeResolve({ browser: true })
    ],
    output: {
        file: './dist/proj4.js',
        format: 'es',
    }
})