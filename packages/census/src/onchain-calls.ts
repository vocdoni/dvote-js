import { zeroPad } from "@ethersproject/bytes"
import { Random, uintArrayToHex } from "@vocdoni/common"
import { IGatewayDVoteClient } from "@vocdoni/client"
import { Proof, RegisterKeyTx, SignedTx, Tx } from "@vocdoni/data-models"
import { Poseidon } from "@vocdoni/hashing"
import { BytesSignature } from "@vocdoni/signing"
import { Signer } from "@ethersproject/abstract-signer"
import { Wallet } from "@ethersproject/wallet"

export namespace CensusOnChainApi {
  /**
   * Get status of an envelope
   * @param processId
   * @param proof A valid franchise proof. See `packageProof`.
   * @param secretKey The bytes of the secret key to use
   * @param weight Hex string (by default "0x1")
   * @param walletOrSigner
   * @param gateway
   */
  export function registerVoterKey(processId: string, proof: Proof, secretKey: Uint8Array, weight: string = "0x1", walletOrSigner: Wallet | Signer, gateway: IGatewayDVoteClient): Promise<any> {
    if (!processId || !proof || !secretKey) return Promise.reject(new Error("Invalid parameters"))
    else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

    const biKey = BigInt(uintArrayToHex(secretKey))
    const hexHashedKey = Poseidon.hash([biKey]).toString(16)
    const newKey = zeroPad("0x" + hexHashedKey, 32)

    const registerKey: RegisterKeyTx = {
      newKey,
      processId: Buffer.from(processId.replace("0x", ""), "hex"),
      nonce: Random.getBytes(32),
      proof,
      weight: Buffer.from(weight.replace("0x", ""), "hex")
    }

    const tx = Tx.encode({ payload: { $case: "registerKey", registerKey } })
    const txBytes = tx.finish()

    return BytesSignature.sign(txBytes, walletOrSigner)
      .then(hexSignature => {
        const signature = new Uint8Array(Buffer.from(hexSignature.replace("0x", ""), "hex"))
        const signedTx = SignedTx.encode({ tx: txBytes, signature })
        const signedTxBytes = signedTx.finish()
        const base64Payload = Buffer.from(signedTxBytes).toString("base64")

        return gateway.sendRequest({ method: "submitRawTx", payload: base64Payload })
      }).catch((error) => {
        const message = (error.message) ? "The key cannot be registered: " + error.message : "The key cannot be registered"
        throw new Error(message)
      })
  }
}
