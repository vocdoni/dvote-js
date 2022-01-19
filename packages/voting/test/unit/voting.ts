// IMPORTANT NOTE:
// Deep testing of on-chain edge cases, race conditions and security enforcement
// is performed on the dvote-solidity repository specs
//
// https://github.com/vocdoni/dvote-solidity/tree/master/test

import "mocha" // using @types/mocha
import { expect } from "chai"
import { Wallet } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import { Buffer } from "buffer/"
import { Voting, VotePackage } from "../../src"
import { BaseProvider } from "@ethersproject/providers"
// import { digestVotePackage } from "../../src/crypto/snarks"
import { strip0x } from "@vocdoni/common"

import { Asymmetric } from "@vocdoni/encryption"
import { IProofCA, IProofEVM, ProofCaSignatureTypes } from "@vocdoni/data-models"
import { ProcessCensusOrigin } from "@vocdoni/contract-wrappers"
import {
    // VoteEnvelope,
    // Proof,
    ProofArbo,
    ProofCA,
    ProofEthereumStorage,
    // ProofIden3,
    // ProofEthereumStorage,
    // ProofEthereumAccount
} from "@vocdoni/data-models"

type TestAccount = {
    privateKey: string,
    address: string,
    provider: BaseProvider,
    wallet: Wallet
}

const defaultMnemonic = "myth like bonus scare over problem client lizard pioneer submit female collect"

const wallets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(idx => Wallet.fromMnemonic(defaultMnemonic, `m/44'/60'/0'/0/${idx}`))
const accounts: TestAccount[] = wallets.map(w => ({
    privateKey: w.privateKey,
    address: w.address,
    provider: w.provider as any,
    wallet: w,
}))
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
// let tx: ContractReceipt

type ProofArboPayload = { $case: "arbo"; arbo: ProofArbo }
type ProofCaPayload = { $case: "ca"; ca: ProofCA }
type ProofEthereumStoragePayload = { $case: "ethereumStorage"; ethereumStorage: ProofEthereumStorage }

addCompletionHooks()

describe("Governance Process", () => {
    beforeEach(() => {
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
        randomAccount1 = accounts[3]
        randomAccount2 = accounts[4]
    })

    describe("Voting", () => {
        describe("Process ID", () => {
            it("Should compute a process ID", () => {
                const items = [
                    {
                        address: "0xdc0809E3c052b1ca21f0fF2f9b221445543401ac",
                        idx: 0,
                        namespace: 1,
                        chainId: 1,
                        expected: "0x629fece5cb9f8165465a14159eba88497f8de3bee5363d874786014014e83ed6"
                    }
                ]

                items.forEach((item) => {
                    const output = Voting.getProcessId(item.address, item.idx, item.namespace, item.chainId)
                    expect(output).to.eq(item.expected)
                })
            })

            it("Should compute a process ID snark friendly", () => {
                const items = [
                    { pid: "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1", expected: "152590315957499152479613644009734485387,278307420464299579500377304315503772392" },
                    { pid: "0xdc44bf8c260abe06a7265c5775ea4fb68ecd1b1940cfa76c1726141ec0da5ddc", expected: "242334442065257808471833509472105350364,292917479466934938504259689620000460174" },
                    { pid: "0x13bf966813b5299110d34b1e565d62d8c26ecb1f76f92ca8bd21fd91600360bc", expected: "287623985268769573942948104428815040275,250393392204297283875746771561056267970" },
                ]

                items.forEach((item) => {
                    const output = Voting.getSnarkProcessId(item.pid).map(v => v.toString()).join(",")
                    expect(output).to.eq(item.expected)
                })
            })
        })

        describe("Anonymous votes", () => {
            it("Should produce a valid ZK proof if the user is eligible to vote in an election")
            it("Should allow to verify that a ZK proof is valid")
            it("Should compute valid anonymous nullifiers", () => {
                const items = [
                    { secretKey: BigInt("0"), processId: "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432", output: BigInt("14028599644617424540428454848827729373173527272190915411559843142191111486030") },
                    { secretKey: BigInt("10000000000"), processId: "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432", output: BigInt("471926944116032573367475862432421920501479013056802055736904890947798361857") },
                    { secretKey: BigInt("200000000000"), processId: "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432", output: BigInt("13437507934415509171799869274537790015840303298534268369808857225632409841144") },
                    { secretKey: BigInt("3000000000000"), processId: "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432", output: BigInt("10857265787995584642999882379896458535361621112363521523476801344802401822530") },
                    { secretKey: BigInt("40000000000000"), processId: "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432", output: BigInt("673513785768439376837662387871573058712918127883794888247884491549757913378") },
                    { secretKey: BigInt("10000000000"), processId: "0x6adf031833174bbe4c85eafe59ddb54e6584648c2c962c6f94791ab49caa0ad4", output: BigInt("5654022798349817370179709640174642612409431742362483837357771779807864411034") },
                    { secretKey: BigInt("200000000000"), processId: "0x6adf031833174bbe4c85eafe59ddb54e6584648c2c962c6f94791ab49caa0ad4", output: BigInt("17657630292507439144875939362269273748142322870382982164520011545218827369700") },
                ]

                for (let item of items) {
                    const output = Voting.getAnonymousVoteNullifier(item.secretKey, item.processId)
                    expect(output).to.eq(item.output)
                }
            })
            it("Should compute valid anonymous hexadecimal nullifiers", () => {
                const items = [
                    { secretKey: BigInt("0"), processId: "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432", output: "0x4e3a949da6df2f1c2f55a0dcea7c138b078b677c1cda842599499bdff0e7031f" },
                    { secretKey: BigInt("10000000000"), processId: "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432", output: "0x01e7dc453a0029bf50067ae3343a1a9e89ef1f7ed0256ca33137e73ce7190b01" },
                    { secretKey: BigInt("200000000000"), processId: "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432", output: "0xf8ed65f4be8c2eb424b7c78aa5abd1a0c9dd2a2b2c2905ce9d626dcd265cb51d" },
                    { secretKey: BigInt("3000000000000"), processId: "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432", output: "0x422794d1ea7a67eafffe98df46e1429db90b5a3fe8d3cf7015d9a167a2fe0018" },
                    { secretKey: BigInt("40000000000000"), processId: "0x56570de287d73cd1cb6092bb8fdee6173974955fdef345ae579ee9f475ea7432", output: "0x22b9a3e4be7fd631f1679aaa9ace99061efefd4e8da7a77c6ca577c4fe317d01" },
                    { secretKey: BigInt("10000000000"), processId: "0x6adf031833174bbe4c85eafe59ddb54e6584648c2c962c6f94791ab49caa0ad4", output: "0x9ad3270ff121c00abf6a6725529ee2e028bbdeebd1e73e7adf13cd654110800c" },
                    { secretKey: BigInt("200000000000"), processId: "0x6adf031833174bbe4c85eafe59ddb54e6584648c2c962c6f94791ab49caa0ad4", output: "0xe43cafa2f22f35faea88cb5640e6178272e288cf588d01d26eb515e054dd0927" },
                ]

                for (let item of items) {
                    const output = Voting.getAnonymousHexNullifier(item.secretKey, item.processId, true)
                    expect(output).to.eq(item.output)
                }
            })
            it("Should package an anonymous envelope")
        })

        describe("Signed votes", () => {
            it("Should compute valid signed envelope nullifiers", () => {
                const processId = "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1"

                const wallet = Wallet.fromMnemonic("seven family better journey display approve crack burden run pattern filter topple")
                expect(wallet.privateKey).to.eq("0xdc44bf8c260abe06a7265c5775ea4fb68ecd1b1940cfa76c1726141ec0da5ddc")
                expect(wallet.address).to.eq("0xaDDAa28Fb1fe87362A6dFdC9d3EEA03d0C221d81")

                let nullifier = Voting.getSignedVoteNullifier(wallet.address, processId)
                expect(nullifier).to.eq("0xf6e3fe2d68f3ccc3af2a7835b302e42c257e2de6539c264542f11e5588e8c162")

                nullifier = Voting.getSignedVoteNullifier(baseAccount.address, processId)
                expect(nullifier).to.eq("0x13bf966813b5299110d34b1e565d62d8c26ecb1f76f92ca8bd21fd91600360bc")

                nullifier = Voting.getSignedVoteNullifier(randomAccount.address, processId)
                expect(nullifier).to.eq("0x25e1ec205509664e2433b9f9930c901eb1f2e31e851468a6ef7329dd9ada3bc8")

                nullifier = Voting.getSignedVoteNullifier(randomAccount1.address, processId)
                expect(nullifier).to.eq("0x419761e28c5103fa4ddac3d575a940c683aa647c31a8ac1073c8780f4664efcb")
            })
        })

        describe("Proofs", () => {
            it("Should package arbo proofs", () => {
                let processId = "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1"
                let siblings = "0x0003000000000000000000000000000000000000000000000000000000000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f"
                let censusProof = { siblings, weight: BigInt("1") }

                const proof1 = Voting.packageSignedProof(processId, new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), censusProof)
                expect(Buffer.from((proof1.payload as ProofArboPayload).arbo.siblings).toString("hex")).to.eq(siblings.slice(2))

                processId = "0x36c886bd2e18605bf03a0428be100313a0f6e568c470d135d3cb72e802045faa"
                siblings = "0x0003000000100000000002000000000300000000000400000000000050000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f"
                censusProof = { siblings, weight: BigInt("1") }

                const proof2 = Voting.packageSignedProof(processId, new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), censusProof)
                expect(Buffer.from((proof2.payload as ProofArboPayload).arbo.siblings).toString("hex")).to.eq(siblings.slice(2))
            })
        })

        describe("Vote Package and Vote Envelope", () => {
            it("Should bundle a Vote Package into a valid Vote Envelope (arbo)", async () => {
                const wallet = Wallet.fromMnemonic("seven family better journey display approve crack burden run pattern filter topple")

                let processId = "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1"
                let siblings = "0x0003000000000000000000000000000000000000000000000000000000000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f"
                let censusProof = { siblings, weight: BigInt("1") }

                const envelope1 = Voting.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: [1, 2, 3], censusProof, processId })
                expect(Buffer.from(envelope1.processId).toString("hex")).to.eq(processId.slice(2))
                expect(Buffer.from((envelope1.proof.payload as ProofArboPayload).arbo.siblings).toString("hex")).to.eq(siblings.slice(2))
                const pkg1: VotePackage = JSON.parse(Buffer.from(envelope1.votePackage).toString())
                expect(pkg1.votes.length).to.eq(3)
                expect(pkg1.votes).to.deep.equal([1, 2, 3])

                processId = "0x36c886bd2e18605bf03a0428be100313a0f6e568c470d135d3cb72e802045faa"
                siblings = "0x0003000000100000000002000000000300000000000400000000000050000006f0d72fbd8b3a637488107b0d8055410180ec017a4d76dbb97bee1c3086a25e25b1a6134dbd323c420d6fc2ac3aaf8fff5f9ac5bc0be5949be64b7cfd1bcc5f1f"
                censusProof = { siblings, weight: BigInt("1") }

                const envelope2 = Voting.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: [5, 6, 7], censusProof, processId })
                expect(Buffer.from(envelope2.processId).toString("hex")).to.eq(processId.slice(2))
                expect(Buffer.from((envelope2.proof.payload as ProofArboPayload).arbo.siblings).toString("hex")).to.eq(siblings.slice(2))
                const pkg2: VotePackage = JSON.parse(Buffer.from(envelope2.votePackage).toString())
                expect(pkg2.votes.length).to.eq(3)
                expect(pkg2.votes).to.deep.equal([5, 6, 7])

                expect(async () => {
                    Voting.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: ["1", "2", "3"], censusProof: siblings, processId } as any)
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

                const envelope1 = Voting.packageSignedEnvelope({ censusOrigin: ProcessCensusOrigin.OFF_CHAIN_CA, votes: [1, 2, 3], censusProof: proof, processId })
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

                const envelope2 = Voting.packageSignedEnvelope({ censusOrigin: ProcessCensusOrigin.OFF_CHAIN_CA, votes: [5, 6, 7], censusProof: proof, processId })
                expect(Buffer.from(envelope2.processId).toString("hex")).to.eq(processId.slice(2))
                expect((envelope2.proof.payload as ProofCaPayload).ca.type).to.eq(proof.type)
                expect(Buffer.from((envelope2.proof.payload as ProofCaPayload).ca.bundle.processId).toString("hex")).to.eq(processId.slice(2))
                expect(Buffer.from((envelope2.proof.payload as ProofCaPayload).ca.bundle.address).toString("hex")).to.eq(proof.voterAddress.toLowerCase().slice(2))
                expect(Buffer.from((envelope2.proof.payload as ProofCaPayload).ca.signature).toString("hex")).to.eq(proof.signature.slice(2))
                const pkg2: VotePackage = JSON.parse(Buffer.from(envelope2.votePackage).toString())
                expect(pkg2.votes.length).to.eq(3)
                expect(pkg2.votes).to.deep.equal([5, 6, 7])

                expect(async () => {
                    Voting.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: ["1", "2", "3"], censusProof: proof, processId } as any)
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

                const envelope1 = Voting.packageSignedEnvelope({ censusOrigin: ProcessCensusOrigin.ERC20, votes: [1, 2, 3], censusProof: proof, processId })
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

                const envelope2 = Voting.packageSignedEnvelope({ censusOrigin: ProcessCensusOrigin.ERC20, votes: [5, 6, 7], censusProof: proof, processId })
                expect(Buffer.from(envelope2.processId).toString("hex")).to.eq(processId.slice(2))
                expect(Buffer.from((envelope2.proof.payload as ProofEthereumStoragePayload).ethereumStorage.key).toString("hex")).to.eq(proof.key.slice(2))
                expect(Buffer.from((envelope2.proof.payload as ProofEthereumStoragePayload).ethereumStorage.value).toString("hex")).to.eq(proof.value.slice(2))
                encodedSiblings = (envelope2.proof.payload as ProofEthereumStoragePayload).ethereumStorage.siblings.map(item => "0x" + Buffer.from(item).toString("hex"))
                expect(encodedSiblings).to.deep.eq(proof.proof)
                const pkg2: VotePackage = JSON.parse(Buffer.from(envelope2.votePackage).toString())
                expect(pkg2.votes.length).to.eq(3)
                expect(pkg2.votes).to.deep.equal([5, 6, 7])

                expect(async () => {
                    Voting.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: ["1", "2", "3"], censusProof: proof, processId } as any)
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
                    const censusProof = { siblings: item.siblings, weight: BigInt("1") }
                    const processKeys = { encryptionPubKeys: [{ idx: 1, key: votePublicKey }] }
                    const envelope = Voting.packageSignedEnvelope({ censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE), votes: item.votes, censusProof, processId: item.processId, processKeys })

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
                    const censusProof = { siblings: item.siblings, weight: BigInt("1") }

                    const envelope = Voting.packageSignedEnvelope({
                        censusOrigin: new ProcessCensusOrigin(ProcessCensusOrigin.OFF_CHAIN_TREE),
                        votes: item.votes,
                        censusProof,
                        processId: item.processId,
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
