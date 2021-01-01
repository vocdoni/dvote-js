// IMPORTANT NOTE:
// Deep testing of on-chain edge cases, race conditions and security enforcement
// is performed on the dvote-solidity repository specs
//
// https://github.com/vocdoni/dvote-solidity/tree/master/test

import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, Wallet } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import { DevWeb3Service, TestAccount } from "../helpers/web3-service"
import { ProcessContractMethods, ProcessContractParameters, ProcessStatus } from "../../src/net/contracts"
import { Buffer } from "buffer/"

import { VotingApi, IVotePackage } from "../../src/api/voting"
import { Asymmetric } from "../../src/util/encryption"
import { checkValidProcessMetadata } from "../../src/models/process"
import ProcessBuilder, {
    DEFAULT_PROCESS_MODE,
    DEFAULT_ENVELOPE_TYPE,
    DEFAULT_CENSUS_ORIGIN,
    DEFAULT_METADATA_CONTENT_HASHED_URI,
    DEFAULT_MERKLE_ROOT,
    DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI,
    DEFAULT_BLOCK_COUNT,
    DEFAULT_START_BLOCK,
    DEFAULT_NAMESPACE,
    DEFAULT_MAX_COUNT,
    DEFAULT_MAX_VALUE,
    DEFAULT_MAX_TOTAL_COST,
    DEFAULT_COST_EXPONENT,
    DEFAULT_MAX_VOTE_OVERWRITES,
    DEFAULT_PARAMS_SIGNATURE
} from "../builders/process"
import ProcessMetadataBuilder from "../builders/process-metadata"
import NamespaceBuilder from "../builders/namespace"
import { Web3Gateway } from "../../src/net/gateway-web3"
import { BytesSignature } from "../../src/util/data-signing"
const {
    VoteEnvelope,
    Proof,
    ProofGraviton,
    // ProofIden3,
    // ProofEthereumStorage,
    // ProofEthereumAccount
} = require("../../lib/protobuf/build/js/common/vote_pb.js")

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let processId: string
let contractInstance: ProcessContractMethods & Contract
// let tx: ContractReceipt

const server = new DevWeb3Service({ port: 9123 })
const nullAddress = "0x0000000000000000000000000000000000000000"

addCompletionHooks()

describe("Governance Process", () => {
    beforeEach(async () => {
        accounts = server.accounts
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
        randomAccount1 = accounts[3]
        randomAccount2 = accounts[4]

        await server.start()
        contractInstance = await new ProcessBuilder(accounts).build()
        processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE)
    })
    afterEach(() => server.stop())

    describe("Smart Contract", () => {

        it("Should attach to a given instance and deal with the same data", async () => {
            // set custom data on a deployed instance
            expect(contractInstance.address).to.be.ok
            const newProcessId = await contractInstance.getNextProcessId(entityAccount.address, DEFAULT_NAMESPACE)

            const namespaceInstance = await new NamespaceBuilder(accounts).build()
            await ProcessBuilder.createDefaultProcess(contractInstance)

            // attach from a new object

            const w3Gw = new Web3Gateway(entityAccount.provider)
            const newInstance = await w3Gw.getProcessesInstance(entityAccount.wallet, contractInstance.address)
            expect(newInstance.address).to.equal(contractInstance.address)

            const contractState = await newInstance.get(newProcessId)
            const data = ProcessContractParameters.fromContract(contractState)
            expect(data.mode.value).to.equal(DEFAULT_PROCESS_MODE)
            expect(data.envelopeType.value).to.equal(DEFAULT_PROCESS_MODE)
            expect(data.censusOrigin.value).to.eq(DEFAULT_CENSUS_ORIGIN)
            expect(data.metadata.toLowerCase()).to.equal(DEFAULT_METADATA_CONTENT_HASHED_URI)
            expect(data.censusMerkleRoot).to.equal(DEFAULT_MERKLE_ROOT)
            expect(data.censusMerkleTree).to.equal(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
            expect(data.entityAddress).to.equal(entityAccount.address)
            expect(data.status.isPaused).to.eq(true)
            expect(data.maxCount).to.eq(DEFAULT_MAX_COUNT)
            expect(data.maxValue).to.eq(DEFAULT_MAX_VALUE)
            expect(data.maxTotalCost).to.eq(DEFAULT_MAX_TOTAL_COST)
            expect(data.costExponent).to.eq(DEFAULT_COST_EXPONENT)
            expect(data.maxVoteOverwrites).to.eq(DEFAULT_MAX_VOTE_OVERWRITES)
            expect(data.namespace).to.eq(DEFAULT_NAMESPACE)
            expect(data.paramsSignature).to.eq(null)  // Not retrieved by contract.get(...)
        })

        it("Should compute process ID's in the same way as the on-chain version", async () => {
            const indexes = []
            for (let i = 0; i < 30; i++) {
                indexes.push(Math.round(Math.random() * 1000000000))
            }

            for (let account of accounts.filter(() => Math.random() >= 0.5)) {
                for (let index of indexes) {
                    let expected = VotingApi.getProcessId(account.address, index, DEFAULT_NAMESPACE)
                    let received = await contractInstance.getProcessId(account.address, index, DEFAULT_NAMESPACE)
                    expect(received).to.equal(expected)
                }
            }
        }).timeout(10000)

        it("The getProcessId() should match getNextProcessId()", async () => {
            // entityAddress has one process created by default from the builder
            expect(await contractInstance.getNextProcessId(entityAccount.address, DEFAULT_NAMESPACE)).to.equal(await contractInstance.getProcessId(entityAccount.address, 1, DEFAULT_NAMESPACE))

            // randomAccount has no process yet
            expect(await contractInstance.getNextProcessId(randomAccount.address, DEFAULT_NAMESPACE)).to.equal(await contractInstance.getProcessId(randomAccount.address, 0, DEFAULT_NAMESPACE))
        })

        it("Should work for any creator account", async () => {
            processId = await contractInstance.getNextProcessId(randomAccount.address, DEFAULT_NAMESPACE)
            const builder = new ProcessBuilder(accounts)

            contractInstance = await builder.withEntityAccount(randomAccount).build()
            let contractState = await contractInstance.get(processId)
            let params = ProcessContractParameters.fromContract(contractState)
            expect(params.entityAddress).to.eq(randomAccount.address)

            processId = await contractInstance.getNextProcessId(randomAccount2.address, DEFAULT_NAMESPACE)
            contractInstance = await builder.withEntityAccount(randomAccount2).build()
            contractState = await contractInstance.get(processId)
            params = ProcessContractParameters.fromContract(contractState)
            expect(params.entityAddress).to.eq(randomAccount2.address)
        }).timeout(5000)
    })

    describe("Results publishing", () => {
        it("Should allow to publish the results", async () => {
            // created by the entity
            contractInstance = await new ProcessBuilder(accounts)
                .withEntityAccount(entityAccount)
                .withOracle(randomAccount1.address)
                .withQuestionCount(2)
                .build()

            const result1 = await contractInstance.getResults(processId)
            expect(result1.tally).to.deep.equal([])
            expect(result1.height).to.equal(0)

            const tx1 = await contractInstance.connect(randomAccount1.wallet).setResults(processId, [[1, 5, 4], [4, 1, 5]], 10)
            expect(tx1).to.be.ok
            expect(tx1.to).to.equal(contractInstance.address)
            await tx1.wait()

            const result2 = await contractInstance.getResults(processId)
            expect(result2.tally).to.deep.equal([[1, 5, 4], [4, 1, 5]])
            expect(result2.height).to.eq(10)
        })

        it("should change the state to RESULTS")
    })

    describe("Voting", () => {
        describe("Vote Package", () => {
            it("Should process a Vote Package")
            it("Should process an encrypted Vote Package")
        })

        describe("Anonymous votes", () => {
            it("Should produce a valid ZK proof if the user is eligible to vote in an election")
            it("Should allow to verify that a ZK proof is valid")
            it("Should compute valid anonymous nullifiers")
            it("Should package an anonymous envelope")
        })
        describe("Signed votes", () => {
            it("Should compute valid signed envelope nullifiers", () => {
                const processId = "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1"

                const wallet = Wallet.fromMnemonic("seven family better journey display approve crack burden run pattern filter topple")
                expect(wallet.privateKey).to.eq("0xdc44bf8c260abe06a7265c5775ea4fb68ecd1b1940cfa76c1726141ec0da5ddc")
                expect(wallet.address).to.eq("0xaDDAa28Fb1fe87362A6dFdC9d3EEA03d0C221d81")

                let nullifier = VotingApi.getSignedVoteNullifier(wallet.address, processId)
                expect(nullifier).to.eq("0xf6e3fe2d68f3ccc3af2a7835b302e42c257e2de6539c264542f11e5588e8c162")

                nullifier = VotingApi.getSignedVoteNullifier(baseAccount.address, processId)
                expect(nullifier).to.eq("0x13bf966813b5299110d34b1e565d62d8c26ecb1f76f92ca8bd21fd91600360bc")

                nullifier = VotingApi.getSignedVoteNullifier(randomAccount.address, processId)
                expect(nullifier).to.eq("0x25e1ec205509664e2433b9f9930c901eb1f2e31e851468a6ef7329dd9ada3bc8")

                nullifier = VotingApi.getSignedVoteNullifier(randomAccount1.address, processId)
                expect(nullifier).to.eq("0x419761e28c5103fa4ddac3d575a940c683aa647c31a8ac1073c8780f4664efcb")
            })
            it("Should package a signed envelope")
        })

        it("Should bundle a Vote Package into a valid Vote Envelope", async () => {
            const wallet = Wallet.fromMnemonic("seven family better journey display approve crack burden run pattern filter topple")

            let processId = "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1"
            let siblings = "0x0003000000000000000000000000000000000000000000000000000000000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f"

            const { envelope: e1, signature: signature1 } = await VotingApi.packageSignedEnvelope({ votes: [1, 2, 3], merkleProof: siblings, processId, walletOrSigner: wallet })
            const envelope1 = VoteEnvelope.deserializeBinary(e1)
            expect(Buffer.from(envelope1.getProcessid()).toString("hex")).to.eq(processId.slice(2))
            expect(Buffer.from(envelope1.getProof().getGraviton().getSiblings()).toString("hex")).to.eq(siblings.slice(2))
            const pkg1: IVotePackage = JSON.parse(Buffer.from(envelope1.getVotepackage()).toString())
            expect(pkg1.votes.length).to.eq(3)
            expect(pkg1.votes).to.deep.equal([1, 2, 3])
            expect(BytesSignature.isValid(signature1, wallet._signingKey().publicKey, e1)).to.eq(true)

            processId = "0x36c886bd2e18605bf03a0428be100313a0f6e568c470d135d3cb72e802045faa"
            siblings = "0x0003000000100000000002000000000300000000000400000000000050000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f"

            const { envelope: e2, signature: signature2 } = await VotingApi.packageSignedEnvelope({ votes: [5, 6, 7], merkleProof: siblings, processId, walletOrSigner: wallet })
            const envelope2 = VoteEnvelope.deserializeBinary(e2)
            expect(Buffer.from(envelope2.getProcessid()).toString("hex")).to.eq(processId.slice(2))
            expect(Buffer.from(envelope2.getProof().getGraviton().getSiblings()).toString("hex")).to.eq(siblings.slice(2))
            const pkg2: IVotePackage = JSON.parse(Buffer.from(envelope2.getVotepackage()).toString())
            expect(pkg2.votes.length).to.eq(3)
            expect(pkg2.votes).to.deep.equal([5, 6, 7])
            expect(BytesSignature.isValid(signature2, wallet._signingKey().publicKey, e2)).to.eq(true)

            expect(async () => {
                await VotingApi.packageSignedEnvelope({ votes: ["1", "2", "3"], merkleProof: siblings, processId, walletOrSigner: wallet } as any)
            }).to.throw
        })

        it("Should bundle an encrypted Vote Package into a valid Vote Envelope", async () => {
            const wallet = Wallet.fromMnemonic("seven family better journey display approve crack burden run pattern filter topple")

            const votePrivateKey = "91f86dd7a9ac258c4908ca8fbdd3157f84d1f74ffffcb9fa428fba14a1d40150"
            const votePublicKey = "6876524df21d6983724a2b032e41471cc9f1772a9418c4d701fcebb6c306af50"

            const processes = [
                {
                    processId: "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1",
                    siblings: "0x0003000000000000000000000000000000000000000000000000000000000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f",
                    votes: [1, 2, 3]
                },
                {
                    processId: "0x36c886bd2e18605bf03a0428be100313a0f6e568c470d135d3cb72e802045faa",
                    siblings: "0x00030000001000000000020000000003000000000004000000000000500000053cd72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f",
                    votes: [4, 5, 6]
                },
                {
                    processId: "0x21c886bd2e18605b733a0428be100313a057e568c470d135d3cb72e312045faa",
                    siblings: "0x00030080001000000080020000400003000003000004000000200000500004053cd72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f",
                    votes: [7, 8, 9]
                }
            ]

            // one key
            for (let item of processes) {
                const processKeys = { encryptionPubKeys: [{ idx: 1, key: votePublicKey }] }
                const { envelope: envelopeBytes, signature } = await VotingApi.packageSignedEnvelope({ votes: item.votes, merkleProof: item.siblings, processId: item.processId, walletOrSigner: wallet, processKeys })
                const envelope = VoteEnvelope.deserializeBinary(envelopeBytes)

                expect(Buffer.from(envelope.getProcessid()).toString("hex")).to.eq(item.processId.slice(2))
                expect(Buffer.from(envelope.getProof().getGraviton().getSiblings()).toString("hex")).to.eq(item.siblings.slice(2))

                expect(envelope.getEncryptionkeyindexesList()).to.be.deep.equal([1])
                const pkgBytes = Buffer.from(envelope.getVotepackage())
                expect(pkgBytes.length).to.be.greaterThan(0)

                const pkg: IVotePackage = JSON.parse(Asymmetric.decryptRaw(pkgBytes, votePrivateKey).toString())
                expect(pkg.votes).to.deep.equal(item.votes)
            }
        })

        it("Should bundle a Vote Package encrypted with N keys in the right order", async () => {
            const wallet = Wallet.fromMnemonic("seven family better journey display approve crack burden run pattern filter topple")

            const encryptionKeys = [
                {
                    publicKey: "2123cee48e684d22e8cc3f4886eac4602df0e31b4260d0f02229f496539e3402",
                    privateKey: "0f658e034979483cd24dca2d67a46a58a99d934922e4f08b3cab00648dda9350"
                },
                {
                    publicKey: "04b86ffbb39c275aae8515d706f6e866644c7f0a1bdefc74ba778e6a1390ac0d",
                    privateKey: "5899a068bc541f9bf56d4b8ae96500d17576e337995797a5c86a0cd1b6f7959b"
                },
                {
                    publicKey: "6d8a5cfdc228c7b134f062e67957cc13f89f04900a23525a76a30809d9039a06",
                    privateKey: "70c83c76baea242d1003c68e079400028b49b790d6cbbd739aff970313f45d5b"
                },
                {
                    publicKey: "90e5f52ce1ec965b8f3a1535b537998687fc6c04400af705f8c4982bca6d6527",
                    privateKey: "398f08935e342e86752d5b52163b403e9ebe50ea53a82bdab6014ce9b49e5a44"
                }
            ]

            const processes = [
                {
                    processId: "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1",
                    siblings: "0x0003000000000000000000000000000000000000000000000000000000000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f",
                    votes: [10, 20, 30]
                },
                {
                    processId: "0x36c886bd2e18605bf03a0428be100313a0f6e568c470d135d3cb72e802045faa",
                    siblings: "0x00030000001000000000020000000003000000000004000000000000500000053cd72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f",
                    votes: [40, 45, 50]
                },
                {
                    processId: "0x21c886bd2e18605b733a0428be100313a057e568c470d135d3cb72e312045faa",
                    siblings: "0x00030080001000000080020000400003000003000004000000200000500004053cd72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f",
                    votes: [22, 33, 44]
                }
            ]

            // N keys
            for (let item of processes) {
                const processKeys = { encryptionPubKeys: encryptionKeys.map((kp, idx) => ({ idx, key: kp.publicKey })) }

                const { envelope: envelopeBytes, signature } = await VotingApi.packageSignedEnvelope({
                    votes: item.votes,
                    merkleProof: item.siblings,
                    processId: item.processId,
                    walletOrSigner: wallet,
                    processKeys
                })
                const envelope = VoteEnvelope.deserializeBinary(envelopeBytes)

                expect(Buffer.from(envelope.getProcessid()).toString("hex")).to.eq(item.processId.slice(2))
                expect(Buffer.from(envelope.getProof().getGraviton().getSiblings()).toString("hex")).to.eq(item.siblings.slice(2))

                expect(envelope.getEncryptionkeyindexesList()).to.be.deep.equal([0, 1, 2, 3])
                const pkgBytes = Buffer.from(envelope.getVotepackage())
                expect(pkgBytes.length).to.be.greaterThan(0)

                let decryptedBuff: Buffer
                // decrypt in reverse order
                for (let i = encryptionKeys.length - 1; i >= 0; i--) {
                    if (i < encryptionKeys.length - 1) {
                        expect(decryptedBuff).to.be.ok
                        decryptedBuff = Asymmetric.decryptRaw(decryptedBuff, encryptionKeys[i].privateKey)
                    }
                    else decryptedBuff = Asymmetric.decryptRaw(pkgBytes, encryptionKeys[i].privateKey)
                }

                const pkg: IVotePackage = JSON.parse(decryptedBuff.toString())
                expect(pkg.votes).to.deep.equal(item.votes)
            }
        })
    })

    describe("Metadata validation", () => {

        it("Should accept a valid Process Metadata JSON", () => {
            const processMetadata = new ProcessMetadataBuilder().build()
            expect(() => {
                checkValidProcessMetadata(processMetadata)
            }).to.not.throw()
        })

        it("Should reject a non valid Process Metadata JSON", () => {
            expect(() => {
                checkValidProcessMetadata(null)
            }).to.throw()
        })

        it("Should reject invalid Process Metadata JSON payloads", () => {
            const processMetadata = new ProcessMetadataBuilder().build()
            // Totally invalid
            expect(() => {
                const payload = JSON.parse('{"test": 123}')
                checkValidProcessMetadata(payload)
            }).to.throw()

            expect(() => {
                const payload = JSON.parse('{"name": {"default": "hello", "fr": "Alô"}}')
                checkValidProcessMetadata(payload)
            }).to.throw()

            expect(() => {
                processMetadata.questions[0].choices[0].value = "a" as any
                checkValidProcessMetadata(processMetadata)
            }).to.throw()
        })

        it("Should reject null required fields", () => {
            const processMetadata = new ProcessMetadataBuilder().build()
            // Incomplete fields
            expect(() => {
                checkValidProcessMetadata(Object.assign({}, processMetadata, { version: null }))
            }).to.throw()
            expect(() => {
                checkValidProcessMetadata(Object.assign({}, processMetadata, { title: null }))
            }).to.throw()
            expect(() => {
                checkValidProcessMetadata(Object.assign({}, processMetadata, { description: null }))
            }).to.throw()
            expect(() => {
                checkValidProcessMetadata(Object.assign({}, processMetadata, { media: null }))
            }).to.throw()
            expect(() => {
                checkValidProcessMetadata(Object.assign({}, processMetadata, { questions: null }))
            }).to.throw()
        })

        it("Should accept big number of questions", () => {
            const processMetadata = new ProcessMetadataBuilder().withNumberOfQuestions(200).build()
            expect(() => {
                checkValidProcessMetadata(processMetadata)
            }).to.not.throw()

            const result = checkValidProcessMetadata(processMetadata)
            expect(result.questions.length).to.equal(200)
        }).timeout(10000)

        it("Should accept big number of choices", () => {
            const processMetadata = new ProcessMetadataBuilder().withNumberOfChoices(200)
            expect(() => {
                checkValidProcessMetadata(processMetadata)
            }).to.not.throw()

            const result = checkValidProcessMetadata(processMetadata)
            expect(result.questions[0].choices.length).to.equal(200)
        }).timeout(4000)
    })
})
