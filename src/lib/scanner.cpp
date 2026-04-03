#include <emscripten/bind.h>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>

using namespace emscripten;

/**
 * High-performance AOB Pattern Scanner for WASM
 * Optimized for large file processing via chunks
 */
class WASMScanner {
private:
    std::vector<uint8_t> pattern_bytes;
    std::vector<bool> pattern_mask;

public:
    WASMScanner(const std::string& pattern) {
        std::stringstream ss(pattern);
        std::string part;
        while (ss >> part) {
            if (part == "??" || part == "xx" || part == "?") {
                pattern_bytes.push_back(0);
                pattern_mask.push_back(false);
            } else {
                try {
                    pattern_bytes.push_back(static_cast<uint8_t>(std::stoul(part, nullptr, 16)));
                    pattern_mask.push_back(true);
                } catch (...) {
                    // Skip invalid hex
                }
            }
        }
    }

    /**
     * Scan a chunk of data for the initialized pattern
     * @param chunk_data Raw bytes of the chunk
     * @param base_offset The absolute offset of this chunk in the original file
     * @returns List of absolute offsets where the pattern was found
     */
    std::vector<uint64_t> scan_chunk(const std::string& chunk_data, uint64_t base_offset) {
        const uint8_t* data = reinterpret_cast<const uint8_t*>(chunk_data.data());
        size_t data_len = chunk_data.size();
        size_t pattern_len = pattern_bytes.size();
        
        std::vector<uint64_t> results;
        if (pattern_len == 0 || pattern_len > data_len) return results;

        // Optimized linear scan
        for (size_t i = 0; i <= data_len - pattern_len; ++i) {
            bool match = true;
            for (size_t j = 0; j < pattern_len; ++j) {
                if (pattern_mask[j] && data[i + j] != pattern_bytes[j]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                results.push_back(base_offset + i);
            }
        }

        return results;
    }
};

EMSCRIPTEN_BINDINGS(scanner_module) {
    register_vector<uint64_t>("VectorUint64");
    class_<WASMScanner>("WASMScanner")
        .constructor<std::string>()
        .function("scan_chunk", &WASMScanner::scan_chunk);
}
