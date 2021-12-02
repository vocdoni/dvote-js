import { BigNumber } from "@ethersproject/bignumber"
import { keccak256 } from "@ethersproject/keccak256"
import { arrayify } from "@ethersproject/bytes"
import { pack } from "@ethersproject/solidity"

import { ProcessMetadata, IProofEVM, IProofCA, IProofArbo, ProcessResultsSingleChoice, SingleChoiceQuestionResults, ProcessResultsSingleQuestion } from "@vocdoni/data-models"
import { Random } from "@vocdoni/common"
import { Buffer } from "buffer/"
import { Asymmetric } from "@vocdoni/encryption"
import { ProcessCensusOrigin, IProcessCensusOrigin } from "@vocdoni/contract-wrappers"
import {
    VoteEnvelope,
    Proof,
    ProofArbo,
    ProofEthereumStorage,
    ProofCA,
    CAbundle,
    ProofArbo_Type
} from "@vocdoni/data-models"
import { Poseidon } from "@vocdoni/hashing"
import { ProofZkSNARK } from "@vocdoni/data-models"
import { ensure0x, strip0x, bigIntToLeBuffer, bufferLeToBigInt, hexStringToBuffer } from "@vocdoni/common"
import { ProcessKeys, SignedEnvelopeParams, VotePackage, AnonymousEnvelopeParams, VoteValues, RawResults } from "./types"

export { VochainWaiter, EthWaiter } from "./util/waiters"


export namespace Voting {
    /**
     * Compute the process ID of an Entity at a given index and namespace
     * @param entityAddress
     * @param processCountIndex
     * @param namespace
     */
    export function getProcessId(entityAddress: string, processCountIndex: number, namespace: number, chainId: number): string {
        if (!entityAddress) throw new Error("Invalid address")

        return keccak256(
            pack(["address", "uint256", "uint32", "uint32"], [entityAddress, processCountIndex, namespace, chainId])
        )
    }

    /** Returns a two-bigint array containing a representation of the given process ID */
    export function getSnarkProcessId(processId: string): [bigint, bigint] {
        const pid = hexStringToBuffer(processId)
        return [
            bufferLeToBigInt(pid.slice(0, 16)),
            bufferLeToBigInt(pid.slice(16, 32)),
        ]
    }

    // See https://vocdoni.io/docs/#/architecture/components/process?id=vote-envelope

    /**
     * Packages the given vote array into a protobuf message that can be sent to Vocdoni Gateways.
     * The voter's signature will be included on the vote, so the voter's anonymity may be public.
     * If `encryptionPublicKey` is defined, it will be used to encrypt the vote package.
     * @param params
     */
    export function packageSignedEnvelope(params: SignedEnvelopeParams): VoteEnvelope {
        if (!params) throw new Error("Invalid parameters")
        else if (!Array.isArray(params.votes)) throw new Error("Invalid votes array")
        else if (typeof params.processId != "string" || !params.processId.match(/^(0x)?[0-9a-zA-Z]+$/)) throw new Error("Invalid processId")
        else if (!params.walletOrSigner || !params.walletOrSigner.signMessage) throw new Error("Invalid wallet or signer")
        else if (params.processKeys) {
            if (!Array.isArray(params.processKeys.encryptionPubKeys) || !params.processKeys.encryptionPubKeys.every(
                item => item && typeof item.idx == "number" && typeof item.key == "string" && item.key.match(/^(0x)?[0-9a-zA-Z]+$/))) {
                throw new Error("Some encryption public keys are not valid")
            }
        }

        const censusOrigin = typeof params.censusOrigin == "number" ?
            new ProcessCensusOrigin(params.censusOrigin as IProcessCensusOrigin) :
            params.censusOrigin

        try {
            const proof = packageSignedProof(params.processId, censusOrigin, params.censusProof)
            const nonce = hexStringToBuffer(Random.getHex())
            const { votePackage, keyIndexes } = packageVoteContent(params.votes, params.processKeys)

            return VoteEnvelope.fromPartial({
                proof,
                processId: new Uint8Array(Buffer.from(strip0x(params.processId), "hex")),
                nonce: new Uint8Array(nonce),
                votePackage: new Uint8Array(votePackage),
                encryptionKeyIndexes: keyIndexes ? keyIndexes : [],
                nullifier: new Uint8Array()
            })
        } catch (error) {
            throw new Error("The poll vote envelope could not be generated")
        }
    }

    /**
     * Packages the given vote array into a JSON payload that can be sent to Vocdoni Gateways.
     * The voter's signature will be included on the vote, so the voter's anonymity may be public.
     * If `encryptionPublicKey` is defined, it will be used to encrypt the vote package.
     * @param params
     */
    export function packageAnonymousEnvelope(params: AnonymousEnvelopeParams): VoteEnvelope {
        if (!params) throw new Error("Invalid parameters")
        else if (typeof params.nullifier != "bigint") throw new Error("Invalid nullifier")
        else if (typeof params.circuitIndex != "number") throw new Error("Invalid nullifier")
        else if (typeof params.zkProof != "object") throw new Error("Invalid proof")

        const { zkProof, processId, nullifier, votePackage, encryptionKeyIndexes } = params

        // [w, x, y, z] => [[w, x], [y, z]]
        const b = [
            zkProof.proof.b[0][0], zkProof.proof.b[0][1],
            zkProof.proof.b[1][0], zkProof.proof.b[1][1],
            zkProof.proof.b[2][0], zkProof.proof.b[2][1]
        ]

        const zkSnark = ProofZkSNARK.fromPartial({
            circuitParametersIndex: params.circuitIndex,
            a: zkProof.proof.a,
            b,
            c: zkProof.proof.c,
            publicInputs: zkProof.publicSignals,
            // type: ProofZkSNARK_Type.UNKNOWN
        })

        const proof = Proof.fromPartial({})
        proof.payload = { $case: "zkSnark", zkSnark }

        const nonce = strip0x(Random.getHex())

        try {
            return VoteEnvelope.fromPartial({
                proof,
                processId: new Uint8Array(hexStringToBuffer(processId)),
                nonce: new Uint8Array(hexStringToBuffer(nonce)),
                votePackage: new Uint8Array(votePackage),
                encryptionKeyIndexes: encryptionKeyIndexes ? encryptionKeyIndexes : [],
                nullifier: new Uint8Array(bigIntToLeBuffer(nullifier))
            })
        } catch (error) {
            throw new Error("The poll vote envelope could not be generated")
        }
    }

    /**
     * Packages the given votes into a buffer. If encryptionPubKeys is defined, the resulting buffer is encrypted with them.
     * @param votes An array of numbers with the choices
     * @param encryptionPubKeys An array of ed25519 public keys (https://ed25519.cr.yp.to/)
     */
    export function packageVoteContent(votes: VoteValues, processKeys?: ProcessKeys): { votePackage: Buffer, keyIndexes?: number[] } {
        if (!Array.isArray(votes)) throw new Error("Invalid votes")
        else if (votes.some(vote => typeof vote != "number")) throw new Error("Votes needs to be an array of numbers")
        else if (processKeys) {
            if (!Array.isArray(processKeys.encryptionPubKeys) || !processKeys.encryptionPubKeys.every(
                item => item && typeof item.idx == "number" && typeof item.key == "string" && item.key.match(/^(0x)?[0-9a-zA-Z]+$/))) {
                throw new Error("Some encryption public keys are not valid")
            }
        }

        // produce a 8 byte nonce
        const nonce = Random.getHex().substr(2, 16)

        const payload: VotePackage = {
            nonce,
            votes
        }
        const strPayload = JSON.stringify(payload)

        if (processKeys && processKeys.encryptionPubKeys && processKeys.encryptionPubKeys.length) {
            // Sort key indexes
            processKeys.encryptionPubKeys.sort((a, b) => a.idx - b.idx)

            const publicKeys: string[] = []
            const publicKeysIdx: number[] = []
            // NOTE: Using all keys by now
            processKeys.encryptionPubKeys.forEach(entry => {
                publicKeys.push(strip0x(entry.key))
                publicKeysIdx.push(entry.idx)
            })

            let votePackage: Buffer
            for (let i = 0; i < publicKeys.length; i++) {
                if (i > 0) votePackage = Asymmetric.encryptRaw(votePackage, publicKeys[i]) // reencrypt votePackage
                else votePackage = Asymmetric.encryptRaw(Buffer.from(strPayload), publicKeys[i]) // encrypt the first
            }
            return { votePackage, keyIndexes: publicKeysIdx }
        }
        else {
            return { votePackage: Buffer.from(strPayload) }
        }
    }

    /** Packages the given parameters into a proof that can be submitted to the Vochain */
    export function packageSignedProof(processId: string, censusOrigin: ProcessCensusOrigin, censusProof: IProofArbo | IProofCA | IProofEVM) {
        const proof = Proof.fromPartial({})

        if (censusOrigin.isOffChain || censusOrigin.isOffChainWeighted) {
            censusProof = censusProof as IProofArbo

            // Check census proof
            if (typeof censusProof?.siblings != "string" || !censusProof?.siblings.match(/^(0x)?[0-9a-zA-Z]+$/))
                throw new Error("Invalid census proof (must be a hex string)")

            const aProof = ProofArbo.fromPartial({
                siblings: new Uint8Array(hexStringToBuffer(censusProof.siblings)),
                type: ProofArbo_Type.BLAKE2B,
                value: new Uint8Array(bigIntToLeBuffer(censusProof.weight || BigInt("1")))
            })
            proof.payload = { $case: "arbo", arbo: aProof }
        }
        else if (censusOrigin.isOffChainCA) {
            // Check census proof
            const resolvedProof = resolveCaProof(censusProof)
            if (!resolvedProof) throw new Error("The proof is not valid")

            const caBundle = CAbundle.fromPartial({
                processId: new Uint8Array(hexStringToBuffer(processId)),
                address: new Uint8Array(hexStringToBuffer(resolvedProof.voterAddress)),
                // weight
            })

            // Populate the proof
            const caProof = ProofCA.fromPartial({
                type: resolvedProof.type,
                signature: new Uint8Array(hexStringToBuffer(resolvedProof.signature)),
                bundle: caBundle
                // weight
            })

            proof.payload = { $case: "ca", ca: caProof }
        }
        else if (censusOrigin.isErc20 || censusOrigin.isErc721 || censusOrigin.isErc1155 || censusOrigin.isErc777) {
            // Check census proof
            const resolvedProof = resolveEvmProof(censusProof)
            if (!resolvedProof) throw new Error("The proof is not valid")

            if (typeof resolvedProof == "string") throw new Error("Invalid census proof for an EVM process")
            else if (typeof resolvedProof.key != "string" ||
                !Array.isArray(resolvedProof.proof) || typeof resolvedProof.value != "string")
                throw new Error("Invalid census proof (must be an object)")

            let hexValue = resolvedProof.value
            if (resolvedProof.value.length % 2 !== 0) {
                hexValue = resolvedProof.value.replace("0x", "0x0")
            }

            const siblings = resolvedProof.proof.map(sibling => new Uint8Array(hexStringToBuffer(sibling)))

            const esProof = ProofEthereumStorage.fromPartial({
                key: new Uint8Array(hexStringToBuffer(resolvedProof.key)),
                value: new Uint8Array(hexStringToBuffer(hexValue)),
                siblings: siblings
            })

            proof.payload = { $case: "ethereumStorage", ethereumStorage: esProof }
        }
        else {
            throw new Error("This process type is not supported yet")
        }
        return proof
    }

    function resolveCaProof(proof: IProofArbo | IProofCA | IProofEVM): IProofCA {
        if (!proof || typeof proof == "string") return null
        // else if (proof["key"] || proof["proof"] || proof["value"]) return null
        else if (typeof proof["type"] != "number" || typeof proof["voterAddress"] != "string" || typeof proof["signature"] != "string") return null
        return proof as IProofCA
    }

    function resolveEvmProof(proof: IProofArbo | IProofCA | IProofEVM): IProofEVM {
        if (!proof || typeof proof == "string") return null
        // else if (proof["type"] || proof["voterAddress"] || proof["signature"]) return null
        else if (typeof proof["key"] != "string" || !Array.isArray(proof["proof"]) || proof["proof"].some(item => typeof item != "string") || typeof proof["value"] != "string") return null
        return proof as IProofEVM
    }

    /**
     * Computes the nullifier of the vote within a process where `envelopeType.ANONYMOUS` is disabled.
     * Returns a hex string with kecak256(bytes(address) + bytes(processId))
     */
    export function getSignedVoteNullifier(address: string, processId: string): string {
        address = strip0x(address)
        processId = strip0x(processId)

        if (address.length != 40) return null
        else if (processId.length != 64) return null

        return keccak256(arrayify(ensure0x(address + processId)))
    }

    /** Computes the nullifier of the vote within a process where `envelopeType.ANONYMOUS` is enabled.
     * @param secretKey BigInt that has been registered on the Vochain for the given proposal
     * @param processId */
    export function getAnonymousVoteNullifier(secretKey: bigint, processId: string) {
        const snarkProcessId = getSnarkProcessId(processId)
        return Poseidon.hash([secretKey, snarkProcessId[0], snarkProcessId[1]])
    }

    /**
     * Arranges the raw results with the titles and the respective options from the metadata.
     * @param rawResults
     * @param metadata
     */
    export function digestSingleChoiceResults(rawResults: RawResults, metadata: ProcessMetadata): ProcessResultsSingleChoice {
        const { results, envelopHeight } = rawResults

        const resultsDigest: ProcessResultsSingleChoice = { totalVotes: envelopHeight, questions: [] }
        const zippedQuestions = metadata.questions.map((meta, idx) => ({ meta, result: results[idx] }))
        resultsDigest.questions = zippedQuestions.map((zippedEntry, idx): SingleChoiceQuestionResults => {
            const zippedOptions = zippedEntry.meta.choices.map((e, i) => ({ title: e.title, value: zippedEntry.result[i] }))
            return {
                title: zippedEntry.meta.title,
                voteResults: zippedOptions.map((option) => ({
                    title: option.title,
                    votes: BigNumber.from(option.value || 0),
                })),
            }
        })
        return resultsDigest
    }

    /**
     * Aggregates the raw results computing the index weighted value for each option of the single question, defined on the metadata.
     * @param rawResults
     * @param metadata
     */
    export function digestSingleQuestionResults(rawResults: RawResults, metadata: ProcessMetadata): ProcessResultsSingleQuestion {
        const { results, envelopHeight } = rawResults
        if (!Array.isArray(results)) throw new Error("Invalid results values")
        else if (!metadata || !metadata.questions || !metadata.questions[0]) throw new Error("Invalid metadata")
        else if (metadata.questions[0].choices.length != rawResults?.results?.length) throw new Error("The raw results don't match with the given metadata")

        const resultsDigest: ProcessResultsSingleQuestion = {
            totalVotes: envelopHeight,
            title: metadata.questions[0].title,
            options: []
        }

        for (let option = 0; option < results.length; option++) {
            let sum = BigNumber.from(0)
            for (let index = 0; index < results[option].length; index++) {
                const str = results[option][index]
                if (!str.match(/^[0-9]+$/)) throw new Error("Invalid result value")
                const v = BigNumber.from(results[option][index])
                sum = sum.add(v.mul(index))
            }
            resultsDigest.options.push({
                title: metadata.questions[0].choices[option].title,
                votes: BigNumber.from(sum)
            })
        }
        return resultsDigest
    }
}
