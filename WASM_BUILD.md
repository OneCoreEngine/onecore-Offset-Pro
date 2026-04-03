# WASM Build Instructions

To compile the `scanner.cpp` to WebAssembly, you need the Emscripten SDK (emsdk).

## Prerequisites
1. Install [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html).
2. Ensure `emcc` is in your PATH.

## Compilation Command
Run the following command in the `src/lib/` directory:

```bash
emcc scanner.cpp -o scanner.js \
  -s WASM=1 \
  -s EXPORTED_RUNTIME_METHODS='["ccall", "cwrap"]' \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s MODULARIZE=1 \
  -s EXPORT_NAME='createScannerModule' \
  --bind \
  -O3
```

## Integration
After compilation, you will get `scanner.js` and `scanner.wasm`.
1. Copy these files to your `src/lib/` directory.
2. Update `worker.ts` to import and use the WASM module for pattern scanning.

### Example Usage in JS:
```javascript
import createScannerModule from './scanner.js';

const module = await createScannerModule();
const scanner = new module.WASMScanner();
const results = module.WASMScanner.scan(buffer, "48 8B 05 ?? ?? ?? ??");
```
