import { SignedTx } from "./protobuf/build/ts/vochain/vochain"

/** Wraps the given bytes and salted signature into a raw transaction */
export function wrapRawTransaction(txBytes: Uint8Array, saltedSignature = new Uint8Array()) {
  const signedTx = SignedTx.encode({ tx: txBytes, signature: saltedSignature })
  const signedTxBytes = signedTx.finish()

  const base64Payload = Buffer.from(signedTxBytes).toString("base64")
  return { method: "submitRawTx", payload: base64Payload }
}
