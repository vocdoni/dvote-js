import * as ArrayBuffToString from 'arraybuffer-to-string'

// STRING <==> BUFFER

export function getStringFromArrayBuffer(buff: ArrayBuffer) {
    return String.fromCharCode.apply(null, new Uint8Array(buff))
}
export function getArrayBufferFromString(payload: string): ArrayBuffer {
    var buf = new ArrayBuffer(payload.length) // 2 bytes for each char
    var bufView = new Uint8Array(buf)
    for (var i = 0, strLen = payload.length; i < strLen; i++) {
        bufView[i] = payload.charCodeAt(i)
    }
    return buf
}

// BUFFER => BUFFER

export function getBase64StringFromArrayBuffer(buff: ArrayBuffer): string {
    return ArrayBuffToString(buff, "base64")
}
