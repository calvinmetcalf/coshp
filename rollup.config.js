import { nodeResolve } from '@rollup/plugin-node-resolve';
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