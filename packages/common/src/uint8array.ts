/**
 * Extract in bytes (Uint8Array) the JSON value of a unique JSON key from a Uint8Array
 * @param array Uint8Array 
 * @param regex RegExp that defines the begining of the JSON value to be extracted (that must bey a unique JSON key)
 */
export function extractUint8ArrayJSONValue(array: Uint8Array, field: string): Uint8Array {
    let c, char2, char3, lastChar
    let countEmbJSON = 0
    let responseStartByte = 0
    let responseEndByte = 0
    const responseStart = '"' + field + '":'
    let out = ""
    let i = 0;
    while (i < array.length) {
        c = array[i++];
        switch (c >> 4) {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                lastChar = String.fromCharCode(c)
                break;
            case 12: case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                lastChar = String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F))
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                lastChar = String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0))
                break;
        }
        if (responseStartByte > 0 && responseEndByte == 0) {
            switch (lastChar) {
                case "{":
                    // Found sub-JSON
                    countEmbJSON++
                    break;
                case "}":
                    if (countEmbJSON == 0) {
                        // Finish search and return
                        responseEndByte = i
                        return array.slice(responseStartByte, responseEndByte)
                    } else if (countEmbJSON > 0) {
                        // Found closed sub-JSON
                        countEmbJSON--
                    } else {
                        // console.error("unexpected character")
                        return new Uint8Array()
                    }
                    break;
            }
        }
        if (responseStartByte == 0 && out.lastIndexOf(responseStart) > -1) {
            responseStartByte = i - 1
        }

        out += lastChar
    }
    // no success
    return new Uint8Array()
}