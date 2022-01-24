import { Signer } from "@ethersproject/abstract-signer"
import { Wallet } from "@ethersproject/wallet"

import { FileApi } from "@vocdoni/client"
import { checkValidProcessMetadata, INewProcessErc20Params } from "@vocdoni/data-models"
import { ApiMethod, IGatewayClient, DVoteGateway } from "@vocdoni/client"
import { ProcessEnvelopeType } from "dvote-solidity" // TODO fix
import { ensure0x } from "@vocdoni/common"

export { VochainWaiter, EthWaiter } from "./util/waiters"

export namespace VotingOracleApi {
    interface TokenDetails {
        balanceMappingPosition: number,
        storageHash: string,
        storageProof: { key: string, proof: string[], value: string }
    }

    /**
    * Use the given JSON metadata to create a new voting process using an EVM-based census from the given token address.
    * The given Metadata will be stored on IPFS
    * @param processParameters The details sent to the smart contract, along with the human readable metadata. See https://vocdoni.io/docs/#/architecture/components/process?id=internal-structs
    * @param proof An Ethereum Storage proof, proving that the wallet address holds tokens on the given token contract
    * @param walletOrSigner
    * @param gateway
    * @param oracle network client
    * @returns The process ID
    * 
    * `tokenDetails` needs to contain the following fields from the ERC20 tokens contract registry
    * 
    * ```ts
    const holderAddress = await wallet.getAddress()

    // Check that the token exists
    const tokenInfo = await CensusErc20Api.getTokenInfo(processParameters.tokenAddress, gateway)
    if (!tokenInfo.isRegistered) return Promise.reject(new Error("The token is not yet registered"))

    // Generate the census proof
    const proof = await CensusErc20Api.generateProof(processParameters.tokenAddress, holderAddress, tokenInfo.balanceMappingPosition, processParameters.sourceBlockHeight, gateway.provider as JsonRpcProvider)
    if (!proof?.storageProof?.length)
        return Promise.reject(new Error("Invalid storage proof"))

    const tokenDetails = {
        balanceMappingPosition: tokenInfo.balanceMappingPosition,
        storageHash: proof.storageHash,
        storageProof: {
            key: proof.storageProof[0].key,
            value: proof.storageProof[0].value,
            proof: proof.storageProof[0].proof
        }
    }
    const pid = await newProcessErc20(params, tokenDetails, wallet, gw, oracle)
    ```
    */
    export async function newProcessErc20(processParameters: INewProcessErc20Params,
        tokenDetails: TokenDetails, walletOrSigner: Wallet | Signer, gateway: IGatewayClient,
        oracleGw: DVoteGateway): Promise<string> {
        if (!processParameters) return Promise.reject(new Error("Invalid process metadata"))
        else if (!processParameters.metadata) return Promise.reject(new Error("Invalid process metadata"))
        else if (!walletOrSigner || !walletOrSigner._isSigner)
            return Promise.reject(new Error("Invalid Wallet or Signer"))
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))
        else if (!oracleGw) return Promise.reject(new Error("Invalid oracle client"))

        try {
            // throw if not valid
            const metadata = checkValidProcessMetadata(processParameters.metadata)

            // UPLOAD THE METADATA
            const strJsonMeta = JSON.stringify(metadata)
            const metadataOrigin = await FileApi.add(strJsonMeta, "process-metadata.json", walletOrSigner, gateway)
            if (!metadataOrigin) return Promise.reject(new Error("The process metadata could not be uploaded"))

            const networkId = await gateway.getEthNetworkId()
            const envelopetype = typeof processParameters.envelopeType == "number" ?
                new ProcessEnvelopeType(processParameters.envelopeType)
                : processParameters.envelopeType

            const requestPayload = {
                method: "newERC20process" as ApiMethod,
                storageProof: tokenDetails.storageProof,
                newProcess: {
                    networkId,
                    entityId: processParameters.tokenAddress,
                    startBlock: processParameters.startBlock,
                    blockCount: processParameters.blockCount,
                    censusRoot: tokenDetails.storageHash,
                    metadata: metadataOrigin,
                    sourceHeight: processParameters.sourceBlockHeight,
                    envelopeType: {
                        serial: envelopetype.hasSerialVoting,
                        anonymous: envelopetype.hasAnonymousVoters,
                        encryptedVotes: envelopetype.hasEncryptedVotes,
                        uniqueValues: envelopetype.hasUniqueValues,
                        costFromWeight: envelopetype.hasCostFromWeight,
                    },
                    voteOptions: {
                        maxCount: processParameters.maxCount,
                        maxValue: processParameters.maxValue,
                        maxVoteOverwrites: processParameters.maxVoteOverwrites,
                        maxTotalCost: processParameters.maxTotalCost,
                        costExponent: processParameters.costExponent
                    },
                    ethIndexSlot: tokenDetails.balanceMappingPosition
                },
            }

            const response = await oracleGw.sendRequest(requestPayload, walletOrSigner)
            if (!response.ok) throw new Error(response.message || null)
            else if (!response.processId) throw new Error()

            return ensure0x(response.processId)
        }
        catch (err) {
            const message = err.message ? "Could not register the process: " + err.message : "Could not register the process"
            throw new Error(message)
        }
    }
}
