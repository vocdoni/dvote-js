import { keccak256 } from "@ethersproject/keccak256"
import { strip0x } from "@vocdoni/common";


type OneOf<T, V extends any[], NK extends keyof V = Exclude<keyof V, keyof any[]>>
  = { [K in NK]: T extends V[K] ? V[K] : never }[NK];

export function digestVocdoniSignedPayload(payload: string | Uint8Array, chainId: string): Uint8Array {
  const encoder = new TextEncoder()
  const prefix = "Vocdoni signed message:\n" + chainId + "\n"

  const payloadBytes = typeof payload === "string" ?
    encoder.encode(payload) : payload
  const digestedPayload = strip0x(keccak256(payloadBytes))

  if (typeof payload === "string") {
    return encoder.encode(prefix + digestedPayload)
  }
  else { // bytes
    const prefixBytes = encoder.encode(prefix)
    const digestedPayloadBytes = encoder.encode(digestedPayload)

    const result = new Uint8Array(prefixBytes.length + digestedPayloadBytes.length)
    result.set(prefixBytes)
    result.set(digestedPayloadBytes, prefixBytes.length)

    return result
  }
}

// JSON

export type JsonLike = boolean | number | string | JsonLike[] | { [k: string]: JsonLike } | null

export function normalizeJsonToString(body: JsonLike): string {
  const sortedRequest = sortJson(body)
  return JSON.stringify(sortedRequest)
}

/**
* Returns a copy of the JSON data so that fields are ordered alphabetically and signatures are 100% reproduceable
* @param data Any valid JSON payload
*/
export function sortJson(data: any) {
  switch (typeof data) {
    case "bigint":
    case "function":
    case "symbol":
      throw new Error("JSON objects with " + typeof data + " values are not supported")
    case "boolean":
    case "number":
    case "string":
    case "undefined":
      return data
  }

  if (Array.isArray(data)) return data.map(item => sortJson(item))

  // Ensure ordered key names
  return Object.keys(data).sort().reduce((prev, cur) => {
    prev[cur] = sortJson(data[cur])
    return prev
  }, {})
}
