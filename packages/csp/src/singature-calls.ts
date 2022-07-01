import { ICsp, CspAuthenticationType } from "@vocdoni/client"
import { CAbundle, IProofCA, ProofCaSignatureTypes, SignedTx, Tx, VoteEnvelope } from "@vocdoni/data-models"
import { CensusBlind } from "@vocdoni/census"
import { hexStringToBuffer, strip0x } from "@vocdoni/common"
import { hexlify } from "@ethersproject/bytes"
import { Keccak256 } from "@vocdoni/hashing"
import { Wallet } from "@ethersproject/wallet"
import { keccak256 } from "@ethersproject/keccak256"
import { UserSecretData } from "blindsecp256k1";



export namespace CspSignatures {

    /**
    * Asks the CSP to provide a blind signature
    * @param payload  The public key that the client creates for performing the vote
    * @param blindToken The elliptic curve token provided by the CSP in earlier authenticaion step
    * @param authStep The current authentication step
    * @param processId The process ID
    * @param csp A CSP instance
    * @returns Promise with blind signature
    */
    export async function getSignature(type: CspAuthenticationType, payload: string, blindToken: string, processId: string, csp: ICsp): Promise<string> {
        if (!processId) return Promise.reject(new Error("Invalid process ID"))
        processId = strip0x(processId)
        if (processId.length != 64) return Promise.reject(new Error("Invalid process ID"))
        else if (!csp) return Promise.reject(new Error("Invalid CSP object"))
        else if (!blindToken) return Promise.reject(new Error("Invalid authentication token"))
        else if (type != "ecdsa" && type != "blind") return Promise.reject(new Error("Invalid signature type"))

        return csp.sendRequest(
            `/auth/elections/${strip0x(processId)}/${type}/sign`,
            {
                payload,
                token: blindToken
            },
            {})
            .then((response) => {
                if (!('signature' in response)) throw new Error('Invalid csp response')
                return response['signature']
            })
            .catch((error) => {
                const message = (error.message) ? "Error getting the blind signature: " + error.message : "Error getting the blind signature"
                throw new Error(message)
            })
    }

    export function getBlindedPayload(electionId: string, hexTokenR: string, ephemeralWallet: Wallet) {
        const tokenR = CensusBlind.decodePoint(hexTokenR)
        const caBundle = CAbundle.fromPartial({
            processId: new Uint8Array(hexStringToBuffer(strip0x(electionId))),
            address: new Uint8Array(hexStringToBuffer(ephemeralWallet.address)),
        })

        // hash(bundle)
        const hexCaBundle = hexlify(CAbundle.encode(caBundle).finish())
        // const hexCaHashedBundle = strip0x(Keccak256.hashText(hexCaBundle))
        const hexCaHashedBundle = strip0x(keccak256(hexCaBundle))


        const { hexBlinded, userSecretData } = CensusBlind.blind(hexCaHashedBundle, tokenR)
        return { hexBlinded, userSecretData }
    }

    export function getProofFromBlindSignature(hexBlindSignature: string, userSecretData: UserSecretData, wallet: Wallet) {
        const unblindedSignature = CensusBlind.unblind(hexBlindSignature, userSecretData)

        const proof: IProofCA = {
          type: ProofCaSignatureTypes.ECDSA_BLIND_PIDSALTED,
          signature: unblindedSignature,
          voterAddress: wallet.address
        }

        return proof
      }
}
