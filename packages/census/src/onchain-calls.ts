import { hexStringToBuffer, Random, bigIntToLeBuffer, bufferLeToBigInt } from "@vocdoni/common"
import { IGatewayDVoteClient } from "@vocdoni/client"
import { Proof, IProofArbo, IProofCA, IProofEVM, RegisterKeyTx, SignedTx, Tx, wrapRawTransaction } from "@vocdoni/data-models"
import { Poseidon } from "@vocdoni/hashing"
import { BytesSignature } from "@vocdoni/signing"
import { Signer } from "@ethersproject/abstract-signer"
import { Wallet } from "@ethersproject/wallet"
import { CensusOnChain } from "./onchain"

export namespace CensusOnChainApi {
  /**
   * Get status of an envelope
   * @param processId
   * @param proof A valid franchise proof. See `packageProof()`.
   * @param secretKey The bytes of the secret key to use
   * @param weight Hex string (by default "0x1")
   * @param walletOrSigner
   * @param gateway
   */
  export function registerVoterKey(processId: string, proof: Proof, secretKey: bigint, requestedWeight: number | bigint, walletOrSigner: Wallet | Signer, gateway: IGatewayDVoteClient): Promise<any> {
    if (!processId || !proof || !secretKey) return Promise.reject(new Error("Invalid parameters"))
    else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))

    const hashedKey = Poseidon.hash([secretKey])
    const newKey = new Uint8Array(bigIntToLeBuffer(hashedKey))

    const registerKey: RegisterKeyTx = {
      newKey,
      processId: new Uint8Array(hexStringToBuffer(processId)),
      nonce: new Uint8Array(Random.getBytes(32)),
      proof,
      weight: requestedWeight.toString()
    }

    const tx = Tx.encode({ payload: { $case: "registerKey", registerKey } })
    const txBytes = tx.finish()

    return gateway.getVocdoniChainId()
      .then(chainId => BytesSignature.signTransaction(txBytes, chainId, walletOrSigner))
      .then(hexSignature => {
        const signature = new Uint8Array(hexStringToBuffer(hexSignature))

        const request = wrapRawTransaction(txBytes, signature)
        return gateway.sendRequest(request)
      }).catch((error) => {
        const message = (error.message) ? "The key cannot be registered: " + error.message : "The key cannot be registered"
        throw new Error(message)
      })
  }

  /**
   * Fetch the proof of the given claim for the rolling census generated on the Vochain
   * @param rollingCensusRoot The Merkle Root of the Census to query
   * @param secretKey Base64-encoded claim of the leaf to request
   * @param gateway
   */
  export function generateProof(rollingCensusRoot: string, secretKey: bigint, gateway: IGatewayDVoteClient): Promise<{ index: bigint, siblings: bigint[] }> {
    if (!rollingCensusRoot || !secretKey || !gateway) return Promise.reject(new Error("Invalid parameters"))
    else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

    const hashedSecretKey = Poseidon.hash([secretKey])

    return gateway.sendRequest({
      method: "genProof",
      censusId: rollingCensusRoot,
      digested: true,
      censusKey: bigIntToLeBuffer(hashedSecretKey).toString("base64"),
      // censusValue: null
    }).then(response => {
      if (typeof response.siblings != "string" || !response.siblings.length) throw new Error("The census proof could not be fetched")

      const responseBuff = Buffer.from(response.siblings, "hex")
      const index = bufferLeToBigInt(responseBuff.slice(0, 8))
      const buffSiblings = new Uint8Array(responseBuff.slice(8))
      const siblings = CensusOnChain.unpackSiblings(buffSiblings)

      return { index, siblings }
    }).catch((error) => {
      const message = (error.message) ? error.message : "The request could not be completed"
      throw new Error(message)
    })
  }
}
