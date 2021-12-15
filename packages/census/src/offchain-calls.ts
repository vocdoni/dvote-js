import { Signer } from "@ethersproject/abstract-signer"
import { Wallet } from "@ethersproject/wallet"
import { IGatewayClient, IRequestParameters } from "@vocdoni/client"
import { CENSUS_MAX_BULK_SIZE } from "@vocdoni/common"
import { Census_Type } from "@vocdoni/data-models"
import { CensusOffChain } from "./offchain"

export namespace CensusOffChainApi {
    /**
     * Asks the Gateway to create a new census and set the given public key as the ones who can manage it
     * @param censusName Name given to the census. Will be used to generate the census ID by trimming spaces and converting text to lowercase
     * @param managerPublicKeys ECDSA public key(s) that can manage this census
     * @param gateway A Gateway instance connected to a remote Gateway
     * @param walletOrSigner
     * @returns Promise resolving with the new censusRoot
     */
    export async function addCensus(censusName: string, managerPublicKeys: string[], walletOrSigner: Wallet | Signer, gateway: IGatewayClient): Promise<{ censusId: string, censusRoot: string }> {
        if (!censusName || !managerPublicKeys || !managerPublicKeys.length || !gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))
        else if (!walletOrSigner || !walletOrSigner._isSigner) return Promise.reject(new Error("Invalid WalletOrSinger object"))

        const censusId = CensusOffChain.generateCensusId(censusName, await walletOrSigner.getAddress())

        // Check if the census already exists
        try {
            // TODO: normalize the `censusId` parameter value
            // Pass the full censusId instead of the second term only
            const existingRoot = await getRoot(censusId, gateway)
            if (typeof existingRoot == "string" && existingRoot.match(/^0x[0-9a-zA-Z]+$/)) return { censusId, censusRoot: existingRoot }
        } catch (error) {
            // If it errors because it doesn't exist, we continue below
        }

        try {
            const censusIdSuffix = CensusOffChain.generateCensusIdSuffix(censusName)
            const response = await gateway.sendRequest({
                method: "addCensus",
                censusId: censusIdSuffix,
                pubKeys: managerPublicKeys,
                censusType: Census_Type.ARBO_BLAKE2B
            }, walletOrSigner)
            const censusRoot = await getRoot(response.censusId, gateway)
            return { censusId: response.censusId, censusRoot }
        } catch (error) {
            const message = (error.message) ? "The census could not be created: " + error.message : "The census could not be created "
            throw new Error(message)
        }
    }

    /**
     * Asks the Gateway to add the given public key to a census previously registered on it.
     * NOTE: This function is intended to be called from NodeJS 10+
     *
     * @param censusId Full Census ID containing the Entity ID and the hash of the original name
     * @param claim The details of the claim to add, including a base64 encoded Public Key (or its keccak256/Poseidon hash) and optionally the voting weight of the key
     * @param digested Set to true if the claim is already hashed. False otherwise.
     * @param gateway A Gateway instance pointing to a remote Gateway
     * @param walletOrSigner
     * @returns Promise resolving with the new censusRoot
     */
    export function addClaim(censusId: string, claim: { key: string, value?: string }, walletOrSigner: Wallet | Signer, gateway: IGatewayClient): Promise<string> {
        if (!censusId || !claim || !claim.key || !claim.key.length || !gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))
        else if (!walletOrSigner || !walletOrSigner._isSigner) return Promise.reject(new Error("Invalid WalletOrSinger object"))

        return gateway.sendRequest({ method: "addClaim", censusId, censusKey: claim.key, digested: false, weight: claim.value || undefined }, walletOrSigner)
            .then((response) => {
                if (typeof response.root == "string") return response.root
                return getRoot(censusId, gateway)
            })
            .catch((error) => {
                const message = (error.message) ? "The claim could not be added: " + error.message : "The claim could not be added."
                throw new Error(message)
            })
    }

    /**
     * Asks the Gateway to add the given public key to a census previously registered on it
     * NOTE: This function is intended to be called from NodeJS 10+
     *
     * @param censusId Full Census ID containing the Entity ID and the hash of the original name
     * @param claimList The list of claims to add, including each a base64 encoded Public Key (or its keccak256/Poseidon hash) and optionally the voting weight of the corresponding key
     * @param digested Set to true if the claims are already hashed. False otherwise.
     * @param gateway A Gateway instance pointing to a remote Gateway
     * @param walletOrSigner
     * @returns Promise resolving with the new censusRoot
     */
    export async function addClaimBulk(censusId: string, claimList: { key: string, value?: string }[], walletOrSigner: Wallet | Signer, gateway: IGatewayClient): Promise<{ censusRoot: string, invalidClaims: any[] }> {
        if (!censusId || !claimList || !claimList.length || !gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))
        else if (!walletOrSigner || !walletOrSigner._isSigner) return Promise.reject(new Error("Invalid WalletOrSinger object"))

        let invalidClaims = []
        let addedClaims = 0
        while (addedClaims < claimList.length) {
            let claims = claimList.slice(addedClaims, addedClaims + CENSUS_MAX_BULK_SIZE)
            addedClaims += CENSUS_MAX_BULK_SIZE
            const partialInvalidClaims = await addClaimChunk(censusId, claims, walletOrSigner, gateway)
            invalidClaims = invalidClaims.concat(partialInvalidClaims)
        }

        const censusRoot = await getRoot(censusId, gateway)

        return { censusRoot, invalidClaims }
    }

    function addClaimChunk(censusId: string, claimList: { key: string, value?: string }[], walletOrSigner: Wallet | Signer, gateway: IGatewayClient): Promise<any[]> {
        if (!censusId || !claimList || claimList.length > CENSUS_MAX_BULK_SIZE || !gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))
        else if (!claimList.length) return Promise.resolve([])
        else if (!walletOrSigner || !walletOrSigner._isSigner) return Promise.reject(new Error("Invalid WalletOrSinger object"))

        const censusKeys = claimList.map(c => c.key)
        const censusValues = claimList.map(c => c.value || undefined).filter(k => !!k)
        if (censusValues.length > 0 && censusKeys.length != censusValues.length) throw new Error("Either all claimList.value elements should be set or all be empty, but not both")

        return gateway.sendRequest({ method: "addClaimBulk", censusId, digested: false, censusKeys, weights: censusValues.length ? censusValues : undefined }, walletOrSigner)
            .then(response => {
                const invalidClaims = ("invalidClaims" in response) ? response.invalidClaims : []
                return invalidClaims
            }).catch(error => {
                const message = (error.message) ? "The given claims could not be added" + error.message : "The given claims could not be added"
                throw new Error(message)
            })
    }

    /**
     * Asks the Gateway to fetch
     * @param censusId The full Census ID to fetch from the Gateway
     * @param gateway A Gateway instance pointing to a remote Gateway
     * @returns Promise resolving with the censusRoot
     */
    export function getRoot(censusId: string, gateway: IGatewayClient): Promise<string> {
        if (!censusId || !gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        return gateway.sendRequest({ method: "getRoot", censusId })
            .then(response => {
                if (!response.root) throw new Error("The census census root could not be fetched")
                return response.root
            }).catch(error => {
                const message = (error.message) ? error.message : "The request could not be completed"
                throw new Error(message)
            })
    }

    /**
     * Get the number of people in the census with the given census Merkle Root Hash
     * @param censusRootHash The Merkle Root of the census to fetch from the Gateway
     * @param dvoteGw A Gateway instance pointing to a remote Gateway
     * @returns Promise resolving with the census size
     */
    export function getSize(censusRootHash: string, gateway: IGatewayClient): Promise<string> {
        if (!censusRootHash || !gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        return gateway.sendRequest({ method: "getSize", censusId: censusRootHash })
            .then(response => {
                if (isNaN(response.size)) throw new Error("The census size could not be retrieved")
                return response.size
            }).catch(error => {
                const message = (error.message) ? error.message : "The request could not be completed"
                throw new Error(message)
            })
    }

    /** Dumps the entire content of the census as base64 string, ready to be imported to another census service
     *
     * The format is as follows:
     * ```
     * [ N * (2+len(k+v)) ]. Where N is the number of key-values, and for each k+v:
     * [ 1 byte | 1 byte | S bytes | len(v) bytes ]
     * [ len(k) | len(v) |   key   |     value    ]
     * ```
     *
     * @param censusId Full Census ID containing the Entity ID and the hash of the original name
     * @param gateway A Gateway instance pointing to a remote Gateway
     * @param walletOrSigner
     * @returns Promise resolving with the a hex array dump of the census claims
    */
    export function dump(censusId: string, walletOrSigner: Wallet | Signer, gateway: IGatewayClient, rootHash?: String): Promise<string> {
        if (!censusId || !gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        const msg: IRequestParameters = (rootHash) ? { method: "dump", censusId, rootHash } : { method: "dump", censusId }

        return gateway.sendRequest(msg, walletOrSigner)
            .then(response => {
                return response.censusDump || ""
            }).catch(error => {
                const message = (error.message) ? "The census merkle root could not be fetched: " + error.message : "The census merkle root could not be fetched"
                throw new Error(message)
            })
    }

    /** Dumps the contents of a census in raw string format. Not valid to use with `importDump`
     *
     * @param censusId Full Census ID containing the Entity ID and the hash of the original name
     * @param walletOrSigner
     * @param gateway A Gateway instance pointing to a remote Gateway
     * @param rootHash
     * @returns Promise resolving with the a raw string dump of the census claims
    */
    export function dumpPlain(censusId: string, walletOrSigner: Wallet | Signer, gateway: IGatewayClient, rootHash?: String): Promise<{ key: string, value: string }[]> {
        if (!censusId || !gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        return dump(censusId, walletOrSigner, gateway, rootHash).then(b64Dump => {
            const buffCensus = Buffer.from(b64Dump, "base64")

            // TODO: Parse buffCensus and extract the values like:

            // [ N * (2+len(k+v)) ]. Where N is the number of key-values, and for each k+v:
            // [ 1 byte | 1 byte | S bytes | len(v) bytes ]
            // [ len(k) | len(v) |   key   |     value    ]

            throw new Error("TODO: Unimplemented")
        })
    }

    /** Only works with specific merkle tree format used by dump method. To add a list of plain claims use `addClaimBulk` instead */
    export function importDump() {
        // TODO: Not implemented
        throw new Error("TODO: Unimplemented")
    }

    /** Import a previously published remote census. Only valid URIs accepted */
    export function importRemote() {
        // TODO: Not implemented
        throw new Error("TODO: Unimplemented")
    }

    /** Exports and publish the entire census on the storage of the backend (usually IPFS). Returns the URI of the set of claims */
    export function publishCensus(censusId: string, walletOrSigner: Wallet | Signer, gateway: IGatewayClient): Promise<string> {
        if (!censusId || !gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))
        else if (!walletOrSigner || !walletOrSigner._isSigner) return Promise.reject(new Error("Invalid WalletOrSinger object"))

        return gateway.sendRequest({ method: "publish", censusId }, walletOrSigner)
            .then(response => {
                if (!response.uri) throw new Error("The census claim URI could not be retrieved")
                return response.uri
            })
            .catch((error) => {
                const message = (error.message) ? error.message : "The request could not be completed"
                throw new Error(message)
            })
    }

    /**
     * Fetch the proof of the given claim on the given census merkle Tree using the given gateway
     * @param censusRoot The Merkle Root of the Census to query
     * @param base64Claim Base64-encoded claim of the leaf to request
     * @param gateway
     */
    export function generateProof(censusRoot: string, { key, value }: { key: string, value?: number }, gateway: IGatewayClient): Promise<{ siblings: string, weight: bigint }> {
        if (!censusRoot || !key || !gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        return gateway.sendRequest({
            method: "genProof",
            censusId: censusRoot,
            digested: false,
            censusKey: key,
            censusValue: value
        }).then(response => {
            if (typeof response.siblings != "string" || !response.siblings.length) throw new Error("The census proof could not be fetched")
            return {
                weight: BigInt(response.weight || "1"),
                siblings: response.siblings
            }
        }).catch((error) => {
            const message = (error.message) ? error.message : "The request could not be completed"
            throw new Error(message)
        })
    }

    export function checkProof() {
        // TODO: Not implemented
        throw new Error("TODO: Unimplemented")
    }

    export function getCensusList(gateway: IGatewayClient): Promise<string[]> {
        if (!gateway) return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid Gateway object"))

        return gateway.sendRequest({ method: "getCensusList" })
            .then(response => {
                return (response.censusList && response.censusList.length) ? response.censusList : []
            }).catch(error => {
                const message = (error.message) ? "The census list could not be fetched: " + error.message : "The census list could not be fetched"
                throw new Error(message)
            })
    }
}
