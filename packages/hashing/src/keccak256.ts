import { keccak256 } from "@ethersproject/keccak256";

export namespace Keccak256 {
    export function hashText(value: string): string {
        return keccak256(Buffer.from(value, "utf8"))
    }
    export function hashHexString(value: string): string {
        return keccak256(Buffer.from(value, "hex"))
    }
    export function hashBytes(value: Uint8Array): string {
        return keccak256(value)
    }
}
