import { Wallet, Signer, providers, BigNumber, ContractReceipt, Contract } from "ethers"
import { IRequestParameters } from "../net/gateway-dvote"
import { Keccak256, Poseidon } from "../crypto/hashing"
import { bigIntToLeBuffer, bufferLeToBigInt, hexStringToBuffer } from "../util/encoding"
import { CENSUS_MAX_BULK_SIZE } from "../constants"
import { ERC20Proof } from "@vocdoni/storage-proofs-eth"
import { compressPublicKey } from "../crypto/elliptic"
import { blind as _blind, unblind as _unblind, verify as _verify, signatureFromHex as _signatureFromHex, signatureToHex as _signatureToHex, pointFromHex as _pointFromHex, pointToHex as _pointToHex, UserSecretData, UnblindedSignature, BigInteger, Point } from "blindsecp256k1"
import { hexZeroPad } from "ethers/lib/utils"
import { IGatewayClient, IGatewayDVoteClient, IGatewayWeb3Client } from "../common"
import { Census_Type, Proof, ProofArbo, ProofArbo_Type, SignedTx, Tx } from "../models/protobuf/build/ts/vochain/vochain"
import { ensure0x, strip0x } from "../util/hex"
import { RegisterKeyTx } from "../models/protobuf"
import { IProofArbo } from "../models/process"
import { Random } from "../util/random"
import { BytesSignature } from "../crypto/data-signing"

// import ContentURI from "../wrappers/content-uri"

export namespace CensusOffChain {
    /**
     * A census ID consists of the Entity Address and the hash of the name.
     * This function returns the full Census ID
     */
    export function generateCensusId(censusName: string, entityAddress: string) {
        const prefix = entityAddress.toLowerCase()
        const suffix = generateCensusIdSuffix(censusName)
        return prefix + "/" + suffix
    }

    /**
     * A census ID consists of the Entity Address and the hash of the name.
     * This function computes the second term
     */
    export function generateCensusIdSuffix(censusName: string) {
        // A census ID consists of the Entity Address and the hash of the name
        // Now computing the second term
        return Keccak256.hashText(censusName.toLowerCase().trim())
    }

    export namespace Public {
        /**
         * Returns a base64 representation of the given ECDSA public key
         */
        export function encodePublicKey(publicKey: string | Uint8Array | Buffer | number[]): string {
            const compPubKey = compressPublicKey(publicKey)
            const pubKeyBytes = hexStringToBuffer(compPubKey)

            return pubKeyBytes.toString("base64")
        }
    }

    export namespace Anonymous {
        /**
         * Returns a base64 representation of the Poseidon hash of the given public key,
         * left padded to 32 bytes
         */
        export function digestPublicKey(x: bigint, y: bigint): string {
            const hashedPubKey = Poseidon.hashBabyJubJubPublicKey(x, y)

            let hexHashedPubKey = hashedPubKey.toString(16)

            // Using big-endian, pad any missing bytes until we get 32 bytes
            while (hexHashedPubKey.length < 64) {
                hexHashedPubKey = "0" + hexHashedPubKey
            }

            return Buffer.from(hexHashedPubKey, "hex").toString("base64")
        }
    }
}

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

        return gateway.sendRequest({ method: "addClaim", censusId, digested: false, censusKey: claim.key, censusValue: claim.value || undefined }, walletOrSigner)
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

        return gateway.sendRequest({ method: "addClaimBulk", censusId, digested: false, censusKeys, censusValues: censusValues.length ? censusValues : undefined }, walletOrSigner)
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
    export function getSize(censusRootHash: string, gateway: IGatewayClient): Promise<number> {
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
                return (response.censusDump && response.censusDump.length) ? response.censusDump : []
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
    export function generateProof(censusRoot: string, { key, value }: { key: string, value?: number }, gateway: IGatewayClient): Promise<string> {
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
            return response.siblings
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

export namespace CensusOnChainApi {
    /**
     * Get status of an envelope
     * @param processId
     * @param proof A valid franchise proof. See `packageSignedProof`.
     * @param secretKey The bytes of the secret key to use
     * @param weight Hex string (by default "0x1")
     * @param walletOrSigner
     * @param gateway
     */
    export function registerVoterKey(processId: string, censusProof: IProofArbo, secretKey: bigint, weight: string = "0x01", walletOrSigner: Wallet | Signer, gateway: IGatewayDVoteClient): Promise<any> {
        if (!processId || typeof secretKey !== "bigint") return Promise.reject(new Error("Invalid parameters"))
        else if (!gateway) return Promise.reject(new Error("Invalid gateway client"))
        else if (typeof censusProof != "string" || !censusProof.match(/^(0x)?[0-9a-zA-Z]+$/))
            throw new Error("Invalid census proof (must be a hex string)")

        const hashedKey = Poseidon.hash([secretKey])
        const newKey = new Uint8Array(bigIntToLeBuffer(hashedKey))

        const proof = Proof.fromPartial({})
        const aProof = ProofArbo.fromPartial({
            siblings: new Uint8Array(Buffer.from(strip0x(censusProof as string), "hex")),
            type: ProofArbo_Type.BLAKE2B
        })
        proof.payload = { $case: "arbo", arbo: aProof }

        const registerKey: RegisterKeyTx = {
            newKey,
            processId: Buffer.from(strip0x(processId), "hex"),
            nonce: Random.getBytes(32),
            proof,
            weight: Buffer.from(strip0x(weight), "hex")
        }

        const tx = Tx.encode({ payload: { $case: "registerKey", registerKey } })
        const txBytes = tx.finish()

        return BytesSignature.sign(txBytes, walletOrSigner).then(hexSignature => {
            const signature = new Uint8Array(Buffer.from(strip0x(hexSignature), "hex"))
            const signedTx = SignedTx.encode({ tx: txBytes, signature })
            const signedTxBytes = signedTx.finish()
            const base64Payload = Buffer.from(signedTxBytes).toString("base64")

            return gateway.sendRequest({ method: "submitRawTx", payload: base64Payload })
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

export namespace CensusOnChain {
    const HASH_FUNCTION_LEN = 32

    export function unpackSiblings(siblings: Uint8Array): bigint[] {
        if (siblings.length < 4) throw new Error("Invalid siblings buffer")

        const fullLen = Number(bufferLeToBigInt(siblings.slice(0, 2)))
        if (siblings.length != fullLen) throw new Error("The expected length doesn't match the siblings size")

        const result: bigint[] = []

        const bitmapBytesLength = Number(bufferLeToBigInt(siblings.slice(2, 4)))
        const bitmapBytes = siblings.slice(4, 4 + bitmapBytesLength)
        const bitmap = bytesToBitmap(bitmapBytes)

        const siblingsBytes = siblings.slice(4 + bitmapBytesLength)
        const emptySibling = BigInt("0")

        let siblingIdx = 0
        for (let i = 0; i < bitmap.length; i++) {
            if (siblingIdx >= siblingsBytes.length) break
            else if (bitmap[i]) {
                const v = siblingsBytes.slice(siblingIdx, siblingIdx + HASH_FUNCTION_LEN)
                result.push(bufferLeToBigInt(v))
                siblingIdx += HASH_FUNCTION_LEN
            }
            else {
                result.push(emptySibling)
            }
        }
        return result
    }

    function bytesToBitmap(bytes: Uint8Array): boolean[] {
        const result: boolean[] = []
        for (let i = 0; i < bytes.length; i++) {
            for (let j = 0; j < 8; j++) {
                result.push(!!(bytes[i] & (1 << j)))
            }
        }
        return result
    }
}

export namespace CensusCaApi {
    /** Decodes the given hex-encoded point */
    export function decodePoint(hexPoint: string): Point {
        return _pointFromHex(hexPoint)
    }

    /** Blinds the given hex string using the given R point and returns the secret data to unblind an eventual blinded signature */
    export function blind(hexMessage: string, signerR: Point): { hexBlinded: string, userSecretData: UserSecretData } {
        const msg = BigInteger.fromHex(hexMessage)
        const { mBlinded, userSecretData } = _blind(msg, signerR)

        return { hexBlinded: hexZeroPad(ensure0x(mBlinded.toString(16)), 32).slice(2), userSecretData }
    }

    /** Unblinds the given blinded signature and returns it as a hex string */
    export function unblind(hexBlindedSignature: string, userSecretData: UserSecretData): string {
        const sBlind = BigInteger.fromHex(hexBlindedSignature)
        const unblindedSignature = _unblind(sBlind, userSecretData)

        return _signatureToHex(unblindedSignature)
    }

    /** Verifies that the given blind signature is valid */
    export function verify(hexMsg: string, hexUnblindedSignature: string, pk: Point) {
        const msg = BigInteger.fromHex(hexMsg)

        const unblindedSignature = signatureFromHex(hexUnblindedSignature)

        return _verify(msg, unblindedSignature, pk)
    }

    /** Deserializes the given hex Signature */
    export function signatureFromHex(hexSignature: string) {
        return _signatureFromHex(hexSignature)
    }

    /** Serializes the given signature into a hex string */
    export function signatureToHex(signature: UnblindedSignature) {
        return _signatureToHex(signature)
    }
}

export namespace CensusErc20Api {
    export function generateProof(tokenAddress: string, holderAddress: string, tokenBalanceMappingPosition: number, blockNumber: number | "latest", provider: providers.JsonRpcProvider | providers.Web3Provider | providers.IpcProvider | providers.InfuraProvider, options?: { verify?: boolean }) {
        return ERC20Proof.get(tokenAddress, holderAddress, tokenBalanceMappingPosition, blockNumber, provider)
    }

    export function verifyProof(stateRoot: string, address: string, proof: any) {
        return ERC20Proof.verify(stateRoot, address, proof)
    }

    /** Finds the balance mapping position of the given ERC20 token address and attempts to register it on the blockchain */
    export async function registerTokenAuto(tokenAddress: string, walletOrSigner: Wallet | Signer, gw: IGatewayWeb3Client, customContractAddress?: string): Promise<ContractReceipt> {
        const contractInstance = await gw.getTokenStorageProofInstance(walletOrSigner, customContractAddress)

        const mapSlot = await CensusErc20Api.findBalanceMappingPosition(tokenAddress, await walletOrSigner.getAddress(), gw.provider as providers.JsonRpcProvider)
        if (mapSlot === null) throw new Error("The given token contract does not seem to have a defined mapping position for the holder balances")

        const tx = await contractInstance.registerToken(tokenAddress, mapSlot)
        return tx.wait()
    }

    /** Associates the given balance mapping position to the given ERC20 token address  */
    export function registerToken(tokenAddress: string, balanceMappingPosition: number | BigNumber, walletOrSigner: Wallet | Signer, gw: IGatewayWeb3Client, customContractAddress?: string): Promise<ContractReceipt> {
        return gw.getTokenStorageProofInstance(walletOrSigner, customContractAddress)
            .then((contractInstance) =>
                contractInstance.registerToken(tokenAddress,
                    balanceMappingPosition
                )
            )
            .then(tx => tx.wait())
    }

    /** Overwrites the token's balance mapping position as long as the provided proof is valid */
    export function setVerifiedBalanceMappingPosition(tokenAddress: string, balanceMappingPosition: number | BigNumber, blockNumber: number | BigNumber, blockHeaderRLP: Buffer, accountStateProof: Buffer, storageProof: Buffer, walletOrSigner: Wallet | Signer, gw: IGatewayWeb3Client, customContractAddress?: string): Promise<ContractReceipt> {
        return gw.getTokenStorageProofInstance(walletOrSigner, customContractAddress)
            .then((contractInstance) =>
                contractInstance.setVerifiedBalanceMappingPosition(tokenAddress,
                    balanceMappingPosition,
                    blockNumber,
                    blockHeaderRLP,
                    accountStateProof,
                    storageProof
                )
            )
            .then(tx => tx.wait())
    }

    export function getTokenInfo(tokenAddress: string, gw: IGatewayWeb3Client, customContractAddress?: string): Promise<{ isRegistered: boolean, isVerified: boolean, balanceMappingPosition: number }> {
        return gw.getTokenStorageProofInstance(null, customContractAddress)
            .then((contractInstance) => contractInstance.tokens(tokenAddress))
            .then((tokenDataTuple) => {
                const balanceMappingPosition = BigNumber.isBigNumber(tokenDataTuple[2]) ?
                    tokenDataTuple[2].toNumber() : tokenDataTuple[2]

                return {
                    isRegistered: tokenDataTuple[0],
                    isVerified: tokenDataTuple[1],
                    balanceMappingPosition
                }
            })
    }

    export function isRegistered(tokenAddress: string, gw: IGatewayWeb3Client, customContractAddress?: string) {
        return gw.getTokenStorageProofInstance(null, customContractAddress)
            .then((contractInstance) => contractInstance.isRegistered(tokenAddress))
    }

    export function getTokenAddressAt(index: number, gw: IGatewayWeb3Client, customContractAddress?: string): Promise<string> {
        return gw.getTokenStorageProofInstance(null, customContractAddress)
            .then((contractInstance) => contractInstance.tokenAddresses(index))
    }

    export function getTokenCount(gw: IGatewayWeb3Client, customContractAddress?: string): Promise<number> {
        return gw.getTokenStorageProofInstance(null, customContractAddress)
            .then((contractInstance) => contractInstance.tokenCount())
    }

    // Helpers

    /**
     * Attempts to find the index at which the holder balances are stored within the token contract.
     * If the position cannot be found among the 50 first ones, `null` is returned.
     */
    export function findBalanceMappingPosition(tokenAddress: string, holderAddress: string, provider: providers.JsonRpcProvider) {
        return ERC20Proof.findMapSlot(tokenAddress, holderAddress, provider)
    }
}
