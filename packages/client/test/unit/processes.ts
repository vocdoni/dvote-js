// IMPORTANT NOTE:
// Deep testing of on-chain edge cases, race conditions and security enforcement
// is performed on the dvote-solidity repository specs
//
// https://github.com/vocdoni/dvote-solidity/tree/master/test

import "mocha" // using @types/mocha
import { expect } from "chai"
import { Wallet } from "ethers"
import { addCompletionHooks } from "../../../../shared/test/mocha-hooks"
import { DevWeb3Service, TestAccount } from "../../../../shared/test/helpers/web3-service"
import { Buffer } from "buffer/"

import { VotingApi, VotePackage } from "../../src"

import { Asymmetric } from "vocdoni-encryption" // TODO: Import from the new NPM package
import { IProofCA, IProofEVM, ProofCaSignatureTypes } from "vocdoni-models" // TODO: Import from the new NPM package
import { ProcessCensusOrigin } from "vocdoni-contracts" // TODO: Import from the new NPM package

import {
    // VoteEnvelope,
    // Proof,
    ProofArbo,
    ProofCA,
    ProofEthereumStorage,
    // ProofIden3,
    // ProofEthereumStorage,
    // ProofEthereumAccount
} from "vocdoni-models" // TODO: Import from the new NPM package

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
// let tx: ContractReceipt

type ProofArboPayload = { $case: "arbo"; arbo: ProofArbo }
type ProofCaPayload = { $case: "ca"; ca: ProofCA }
type ProofEthereumStoragePayload = { $case: "ethereumStorage"; ethereumStorage: ProofEthereumStorage }

const server = new DevWeb3Service({ port: 9123 })

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
    })
    afterEach(() => server.stop())

    describe("Voting", () => {
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
        })

        describe("Proofs", () => {
            it("Should package arbo proofs", () => {
                let processId = "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1"
                let siblings = "0x0003000000000000000000000000000000000000000000000000000000000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f"

                const proof1 = VotingApi.packageProof(processId, new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), siblings)
                expect(Buffer.from((proof1.payload as ProofArboPayload).arbo.siblings).toString("hex")).to.eq(siblings.slice(2))

                processId = "0x36c886bd2e18605bf03a0428be100313a0f6e568c470d135d3cb72e802045faa"
                siblings = "0x0003000000100000000002000000000300000000000400000000000050000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f"

                const proof2 = VotingApi.packageProof(processId, new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), siblings)
                expect(Buffer.from((proof2.payload as ProofArboPayload).arbo.siblings).toString("hex")).to.eq(siblings.slice(2))
            })
        })

        describe("Vote Package and Vote Envelope", () => {
            it("Should bundle a Vote Package into a valid Vote Envelope (arbo)", async () => {
                const wallet = Wallet.fromMnemonic("seven family better journey display approve crack burden run pattern filter topple")

                let processId = "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1"
                let siblings = "0x0003000000000000000000000000000000000000000000000000000000000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f"

                const envelope1 = await VotingApi.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: [1, 2, 3], censusProof: siblings, processId, walletOrSigner: wallet })
                expect(Buffer.from(envelope1.processId).toString("hex")).to.eq(processId.slice(2))
                expect(Buffer.from((envelope1.proof.payload as ProofArboPayload).arbo.siblings).toString("hex")).to.eq(siblings.slice(2))
                const pkg1: VotePackage = JSON.parse(Buffer.from(envelope1.votePackage).toString())
                expect(pkg1.votes.length).to.eq(3)
                expect(pkg1.votes).to.deep.equal([1, 2, 3])

                processId = "0x36c886bd2e18605bf03a0428be100313a0f6e568c470d135d3cb72e802045faa"
                siblings = "0x0003000000100000000002000000000300000000000400000000000050000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f"

                const envelope2 = await VotingApi.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: [5, 6, 7], censusProof: siblings, processId, walletOrSigner: wallet })
                expect(Buffer.from(envelope2.processId).toString("hex")).to.eq(processId.slice(2))
                expect(Buffer.from((envelope2.proof.payload as ProofArboPayload).arbo.siblings).toString("hex")).to.eq(siblings.slice(2))
                const pkg2: VotePackage = JSON.parse(Buffer.from(envelope2.votePackage).toString())
                expect(pkg2.votes.length).to.eq(3)
                expect(pkg2.votes).to.deep.equal([5, 6, 7])

                expect(async () => {
                    await VotingApi.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: ["1", "2", "3"], censusProof: siblings, processId, walletOrSigner: wallet } as any)
                }).to.throw
            })

            it("Should bundle a Vote Package into a valid Vote Envelope (CA)", async () => {
                const wallet = Wallet.fromMnemonic("seven family better journey display approve crack burden run pattern filter topple")

                let processId = "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1"
                let proof: IProofCA = {
                    type: ProofCaSignatureTypes.ECDSA,
                    voterAddress: wallet.address,
                    signature: "0x1234",
                }

                const envelope1 = await VotingApi.packageSignedEnvelope({ censusOrigin: ProcessCensusOrigin.OFF_CHAIN_CA, votes: [1, 2, 3], censusProof: proof, processId, walletOrSigner: wallet })
                expect(Buffer.from(envelope1.processId).toString("hex")).to.eq(processId.slice(2))
                expect((envelope1.proof.payload as ProofCaPayload).ca.type).to.eq(proof.type)
                expect(Buffer.from((envelope1.proof.payload as ProofCaPayload).ca.bundle.processId).toString("hex")).to.eq(processId.slice(2))
                expect(Buffer.from((envelope1.proof.payload as ProofCaPayload).ca.bundle.address).toString("hex")).to.eq(proof.voterAddress.toLowerCase().slice(2))
                expect(Buffer.from((envelope1.proof.payload as ProofCaPayload).ca.signature).toString("hex")).to.eq(proof.signature.slice(2))
                const pkg1: VotePackage = JSON.parse(Buffer.from(envelope1.votePackage).toString())
                expect(pkg1.votes.length).to.eq(3)
                expect(pkg1.votes).to.deep.equal([1, 2, 3])

                processId = "0x36c886bd2e18605bf03a0428be100313a0f6e568c470d135d3cb72e802045faa"
                proof = {
                    type: ProofCaSignatureTypes.ECDSA_BLIND,
                    voterAddress: wallet.address,
                    signature: "0x1234",
                }

                const envelope2 = await VotingApi.packageSignedEnvelope({ censusOrigin: ProcessCensusOrigin.OFF_CHAIN_CA, votes: [5, 6, 7], censusProof: proof, processId, walletOrSigner: wallet })
                expect(Buffer.from(envelope2.processId).toString("hex")).to.eq(processId.slice(2))
                expect((envelope2.proof.payload as ProofCaPayload).ca.type).to.eq(proof.type)
                expect(Buffer.from((envelope2.proof.payload as ProofCaPayload).ca.bundle.processId).toString("hex")).to.eq(processId.slice(2))
                expect(Buffer.from((envelope2.proof.payload as ProofCaPayload).ca.bundle.address).toString("hex")).to.eq(proof.voterAddress.toLowerCase().slice(2))
                expect(Buffer.from((envelope2.proof.payload as ProofCaPayload).ca.signature).toString("hex")).to.eq(proof.signature.slice(2))
                const pkg2: VotePackage = JSON.parse(Buffer.from(envelope2.votePackage).toString())
                expect(pkg2.votes.length).to.eq(3)
                expect(pkg2.votes).to.deep.equal([5, 6, 7])

                expect(async () => {
                    await VotingApi.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: ["1", "2", "3"], censusProof: proof, processId, walletOrSigner: wallet } as any)
                }).to.throw
            })

            it("Should bundle a Vote Package into a valid Vote Envelope (EVM)", async () => {
                const wallet = Wallet.fromMnemonic("seven family better journey display approve crack burden run pattern filter topple")

                let processId = "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1"
                let proof: IProofEVM = {
                    key: "0x1234",
                    proof: ["0x10", "0x20", "0x30", "0x40"],
                    value: "0x0000000000000000000000000000000000000000000000000000000000023456"
                }

                const envelope1 = await VotingApi.packageSignedEnvelope({ censusOrigin: ProcessCensusOrigin.ERC20, votes: [1, 2, 3], censusProof: proof, processId, walletOrSigner: wallet })
                expect(Buffer.from(envelope1.processId).toString("hex")).to.eq(processId.slice(2))
                expect(Buffer.from((envelope1.proof.payload as ProofEthereumStoragePayload).ethereumStorage.key).toString("hex")).to.eq(proof.key.slice(2))
                expect(Buffer.from((envelope1.proof.payload as ProofEthereumStoragePayload).ethereumStorage.value).toString("hex")).to.eq(proof.value.slice(2))
                let encodedSiblings = (envelope1.proof.payload as ProofEthereumStoragePayload).ethereumStorage.siblings.map(item => "0x" + Buffer.from(item).toString("hex"))
                expect(encodedSiblings).to.deep.eq(proof.proof)
                const pkg1: VotePackage = JSON.parse(Buffer.from(envelope1.votePackage).toString())
                expect(pkg1.votes.length).to.eq(3)
                expect(pkg1.votes).to.deep.equal([1, 2, 3])

                processId = "0x36c886bd2e18605bf03a0428be100313a0f6e568c470d135d3cb72e802045faa"
                proof = {
                    key: "0x5678",
                    proof: ["0x50", "0x60", "0x70", "0x80"],
                    value: "0x0000000000000000000000000000000000000000000000000000000078901234"
                }

                const envelope2 = await VotingApi.packageSignedEnvelope({ censusOrigin: ProcessCensusOrigin.ERC20, votes: [5, 6, 7], censusProof: proof, processId, walletOrSigner: wallet })
                expect(Buffer.from(envelope2.processId).toString("hex")).to.eq(processId.slice(2))
                expect(Buffer.from((envelope2.proof.payload as ProofEthereumStoragePayload).ethereumStorage.key).toString("hex")).to.eq(proof.key.slice(2))
                expect(Buffer.from((envelope2.proof.payload as ProofEthereumStoragePayload).ethereumStorage.value).toString("hex")).to.eq(proof.value.slice(2))
                encodedSiblings = (envelope2.proof.payload as ProofEthereumStoragePayload).ethereumStorage.siblings.map(item => "0x" + Buffer.from(item).toString("hex"))
                expect(encodedSiblings).to.deep.eq(proof.proof)
                const pkg2: VotePackage = JSON.parse(Buffer.from(envelope2.votePackage).toString())
                expect(pkg2.votes.length).to.eq(3)
                expect(pkg2.votes).to.deep.equal([5, 6, 7])

                expect(async () => {
                    await VotingApi.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: ["1", "2", "3"], censusProof: proof, processId, walletOrSigner: wallet } as any)
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
                    const envelope = await VotingApi.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: item.votes, censusProof: item.siblings, processId: item.processId, walletOrSigner: wallet, processKeys })

                    expect(Buffer.from(envelope.processId).toString("hex")).to.eq(item.processId.slice(2))
                    expect(Buffer.from((envelope.proof.payload as ProofArboPayload).arbo.siblings).toString("hex")).to.eq(item.siblings.slice(2))

                    expect(envelope.encryptionKeyIndexes).to.be.deep.equal([1])
                    const pkgBytes = Buffer.from(envelope.votePackage)
                    expect(pkgBytes.length).to.be.greaterThan(0)

                    const pkg: VotePackage = JSON.parse(Asymmetric.decryptRaw(pkgBytes, votePrivateKey).toString())
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

                    const envelope = await VotingApi.packageSignedEnvelope({
                        censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE),
                        votes: item.votes,
                        censusProof: item.siblings,
                        processId: item.processId,
                        walletOrSigner: wallet,
                        processKeys
                    })

                    expect(Buffer.from(envelope.processId).toString("hex")).to.eq(item.processId.slice(2))
                    expect(Buffer.from((envelope.proof.payload as ProofArboPayload).arbo.siblings).toString("hex")).to.eq(item.siblings.slice(2))

                    expect(envelope.encryptionKeyIndexes).to.be.deep.equal([0, 1, 2, 3])
                    const pkgBytes = Buffer.from(envelope.votePackage)
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

                    const pkg: VotePackage = JSON.parse(decryptedBuff.toString())
                    expect(pkg.votes).to.deep.equal(item.votes)
                }
            })
        })
    })
})
