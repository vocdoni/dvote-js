import { keccak256 } from "@ethersproject/keccak256"
import { toUtf8Bytes } from "@ethersproject/strings"
import { hexlify } from "@ethersproject/bytes"

type OneOf<T, V extends any[], NK extends keyof V = Exclude<keyof V, keyof any[]>>
  = { [K in NK]: T extends V[K] ? V[K] : never }[NK];

export function digestVocdoniSignedPayload<T extends string | Uint8Array>(payload: T, chainId?: number): OneOf<T, [string, Uint8Array]>;

export function digestVocdoniSignedPayload<T extends string | Uint8Array>(payload: T, chainId = 0) {
  const prefix = "Vocdoni signed message:\n" + chainId + "\n"

  if (typeof payload === "string") {
    return prefix + keccak256(toUtf8Bytes(payload))
  }
  else {
    const prefixBytes = toUtf8Bytes(prefix)
    const digestedPayload = toUtf8Bytes(hexlify(keccak256(payload)))

    const result = new Uint8Array(prefixBytes.length + digestedPayload.length)
    result.set(prefixBytes)
    result.set(digestedPayload, prefixBytes.length)

    return result
  }
}
