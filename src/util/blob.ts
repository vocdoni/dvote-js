export function readBlobText(data: Blob): Promise<string> {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
        reader.onerror = () => {
            reader.abort();
            reject(new Error("Problem parsing input file."));
        };
        reader.onload = () => {
            resolve(reader.result as string);
        };
        reader.readAsText(data);
    });
}

export function readBlobArrayBuffer(data: Blob): Promise<ArrayBuffer> {
    const reader = new FileReader()
    return new Promise((resolve, reject) => {
        reader.onerror = () => {
            reader.abort();
            reject(new Error("Could not read the response bytes"));
        };
        reader.onload = () => {
            resolve(reader.result as ArrayBuffer);
        };
        reader.readAsArrayBuffer(data);
    });
}