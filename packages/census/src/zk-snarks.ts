// @ts-ignore  
import { groth16 } from "snarkjs"
import { bufferLeToBigInt, hexStringToBuffer } from "@vocdoni/common"
import { ZkProof } from "@vocdoni/data-models"
import { sha256 } from "@ethersproject/sha2"

export type ZkInputs = {
    processId: [bigint, bigint]
    /** hex string */
    censusRoot: string
    censusSiblings: bigint[]
    maxSize: number
    keyIndex: bigint
    secretKey: bigint
    votePackage: Uint8Array
    /** hex string */
    nullifier: bigint
}

export namespace ZkSnarks {
    export function computeProof(input: ZkInputs, witnessGeneratorWasm: Uint8Array, zKey: Uint8Array): Promise<ZkProof> {
        return getWitnessCalculator(witnessGeneratorWasm)
            .then(witnessCalculator => {
                const censusRootLe = Buffer.from(input.censusRoot, "hex")
                const censusRoot = bufferLeToBigInt(censusRootLe)
                const voteHash = digestVotePackage(input.votePackage)

                const censusSiblings = [].concat(input.censusSiblings)
                const levels = Math.ceil(Math.log2(input.maxSize))
                for (let i = censusSiblings.length; i < levels+1; i++) {
                    censusSiblings.push(BigInt("0"))
                }

                const proverInputs = {
                    censusRoot,
                    censusSiblings,
                    index: input.keyIndex,
                    secretKey: input.secretKey,
                    voteHash,
                    processId: input.processId,
                    nullifier: input.nullifier
                }

                return witnessCalculator.computeWTNSBin(proverInputs, true)
            })
            .then(wtnsBuff => groth16.prove(zKey, wtnsBuff))
            .then(({ proof, publicSignals }) => {
                return {
                    proof: {
                        a: <string[]>proof.pi_a,
                        b: <string[][]>proof.pi_b,
                        c: <string[]>proof.pi_c,
                        protocol: <string>proof.protocol,
                        // curve: <string>proof.curve || "bn128",
                    },
                    publicSignals: <string[]>publicSignals
                }
            })
    }

    export function verifyProof(verificationKey: { [k: string]: any }, publicSignals: Array<bigint>,
        proof: { a: string, b: string, c: string, protocol: string }): Promise<boolean> {
        const gProof = {
            pi_a: proof.a,
            pi_b: proof.b,
            pi_c: proof.c,
            protocol: proof.protocol,
            // curve: proof.curve,
        }

        return groth16.verify(verificationKey, publicSignals, gProof)
    }

    export function digestVotePackage(votePackage: Uint8Array): [bigint, bigint] {
        const hexHashed = sha256(votePackage)
        const buffHashed = hexStringToBuffer(hexHashed)
        return [
            bufferLeToBigInt(buffHashed.slice(0, 16)),
            bufferLeToBigInt(buffHashed.slice(16, 32)),
        ]
    }

    ///////////////////////////////////////////////////////////////////////////////
    // HELPERS
    ///////////////////////////////////////////////////////////////////////////////

    async function getWitnessCalculator(code: Uint8Array) {
        const wasmModule = await WebAssembly.compile(code);

        const instance = await WebAssembly.instantiate(wasmModule, {
            runtime: {
                exceptionHandler: (code: number) => {
                    let errStr: string
                    switch (code) {
                        case 1: errStr = "Signal not found."; break
                        case 2: errStr = "Too many signals set."; break
                        case 3: errStr = "Signal already set."; break
                        case 4: errStr = "Assert Failed."; break
                        case 5: errStr = "Not enough memory."; break
                        default: errStr = "Unknown error"; break
                    }
                    throw new Error(errStr + " " + getMessage())
                },
                showSharedRWMemory: () => { }
            }
        })

        return new WitnessCalculator(instance)

        function getMessage() {
            const getMessageChar = (instance.exports as any).getMessageChar
            if (!getMessageChar) return ""

            let message = ""
            let c = getMessageChar()
            while (c != 0) {
                message += String.fromCharCode(c)
                c = getMessageChar()
            }
            return message
        }
    }


    class WitnessCalculator {
        instance: WebAssembly.Instance
        version: number
        n32: number
        prime: bigint
        witnessSize: number
        sanityCheck?: boolean

        constructor(instance: WebAssembly.Instance, sanityCheck?: boolean) {
            this.instance = instance

            this.version = this.instanceMethods.getVersion()
            this.n32 = this.instanceMethods.getFieldNumLen32()

            this.instanceMethods.getRawPrime()  // needed?
            const arr = new Array(this.n32)
            for (let i = 0; i < this.n32; i++) {
                arr[this.n32 - 1 - i] = this.instanceMethods.readSharedRWMemory(i)
            }
            this.prime = fromArray32(arr)

            this.witnessSize = this.instanceMethods.getWitnessSize()

            this.sanityCheck = sanityCheck
        }

        get instanceMethods() {
            return this.instance.exports as any
        }

        circomVersion(): string {
            return this.instanceMethods.getVersion()
        }

        private async _doWitnessComputation(input, sanityCheck?: boolean) {
            //input is assumed to be a map from signals to arrays of bigints
            this.instanceMethods.init((this.sanityCheck || sanityCheck) ? 1 : 0)

            const keys = Object.keys(input)
            keys.forEach((k) => {
                const h = fnvHash(k)
                const hMSB = parseInt(h.slice(0, 8), 16)
                const hLSB = parseInt(h.slice(8, 16), 16)
                const fArr = flatArray<bigint>(input[k])

                for (let i = 0; i < fArr.length; i++) {
                    const arrFr = toArray32(fArr[i], this.n32)
                    for (let j = 0; j < this.n32; j++) {
                        this.instanceMethods.writeSharedRWMemory(j, arrFr[this.n32 - 1 - j])
                    }
                    this.instanceMethods.setInputSignal(hMSB, hLSB, i)
                }
            })
        }

        async computeWitness(input, sanityCheck?: boolean) {
            const w = []

            await this._doWitnessComputation(input, sanityCheck)

            for (let i = 0; i < this.witnessSize; i++) {
                this.instanceMethods.getWitness(i)
                const arr = new Array(this.n32)
                for (let j = 0; j < this.n32; j++) {
                    arr[this.n32 - 1 - j] = this.instanceMethods.readSharedRWMemory(j)
                }
                w.push(fromArray32(arr))
            }

            return w
        }

        async computeBinWitness(input, sanityCheck?: boolean) {
            const buff32 = new Uint32Array(this.witnessSize * this.n32)
            const buff = new Uint8Array(buff32.buffer)
            await this._doWitnessComputation(input, sanityCheck)

            for (let i = 0; i < this.witnessSize; i++) {
                this.instanceMethods.getWitness(i)
                const pos = i * this.n32
                for (let j = 0; j < this.n32; j++) {
                    buff32[pos + j] = this.instanceMethods.readSharedRWMemory(j)
                }
            }

            return buff
        }

        async computeWTNSBin(inputs, sanityCheck?: boolean) {
            const buff32 = new Uint32Array(this.witnessSize * this.n32 + this.n32 + 11)
            const buff = new Uint8Array(buff32.buffer)
            await this._doWitnessComputation(inputs, sanityCheck)

            //"wtns"
            buff[0] = "w".charCodeAt(0)
            buff[1] = "t".charCodeAt(0)
            buff[2] = "n".charCodeAt(0)
            buff[3] = "s".charCodeAt(0)

            //version 2
            buff32[1] = 2

            //number of sections: 2
            buff32[2] = 2

            //id section 1
            buff32[3] = 1

            const n8 = this.n32 * 4
            //id section 1 length in 64bytes
            const idSection1length = 8 + n8
            const idSection1lengthHex = idSection1length.toString(16)
            buff32[4] = parseInt(idSection1lengthHex.slice(0, 8), 16)
            buff32[5] = parseInt(idSection1lengthHex.slice(8, 16), 16) || 0

            //this.n32
            buff32[6] = n8

            //prime number
            this.instanceMethods.getRawPrime()

            var pos = 7
            for (let j = 0; j < this.n32; j++) {
                buff32[pos + j] = this.instanceMethods.readSharedRWMemory(j)
            }
            pos += this.n32

            // witness size
            buff32[pos] = this.witnessSize
            pos++

            //id section 2
            buff32[pos] = 2
            pos++

            // section 2 length
            const idSection2length = n8 * this.witnessSize
            const idSection2lengthHex = idSection2length.toString(16)
            buff32[pos] = parseInt(idSection2lengthHex.slice(0, 8), 16)
            buff32[pos + 1] = parseInt(idSection2lengthHex.slice(8, 16), 16) || 0

            pos += 2
            for (let i = 0; i < this.witnessSize; i++) {
                this.instanceMethods.getWitness(i)
                for (let j = 0; j < this.n32; j++) {
                    buff32[pos + j] = this.instanceMethods.readSharedRWMemory(j)
                }
                pos += this.n32
            }
            return buff
        }
    }

    function fromArray32(arr: Array<number>): bigint { //returns a BigInt
        let res = BigInt(0)
        const radix = BigInt(0x100000000)
        for (let i = 0; i < arr.length; i++) {
            res = res * radix + BigInt(arr[i])
        }
        return res
    }

    function toArray32(s: bigint, size: number) {
        const res = <Array<number>>[] //new Uint32Array(size); //has no unshift
        let rem = BigInt(s)
        const radix = BigInt(0x100000000)
        while (rem) {
            res.unshift(Number(rem % radix))
            rem = rem / radix
        }
        if (size) {
            let i = size - res.length
            while (i > 0) {
                res.unshift(0)
                i--
            }
        }
        return res
    }

    function flatArray<T>(a: T | Array<T>) {
        const res: Array<T> = []
        fillArray(res, a)
        return res
    }

    function fillArray<T>(res: Array<T>, a: T | Array<T>) {
        if (Array.isArray(a)) {
            for (let i = 0; i < a.length; i++) {
                fillArray(res, a[i])
            }
        } else {
            res.push(a)
        }
    }

    function fnvHash(str: string) {
        const uint64_max = BigInt("18446744073709551616") // 2^64
        let hash = BigInt("0xCBF29CE484222325")
        for (var i = 0; i < str.length; i++) {
            hash ^= BigInt(str.charCodeAt(i))
            hash *= BigInt(0x100000001B3)
            hash %= uint64_max
        }
        let shash = hash.toString(16)
        const n = 16 - shash.length
        shash = '0'.repeat(n).concat(shash)
        return shash
    }
}
