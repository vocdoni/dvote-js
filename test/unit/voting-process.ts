// IMPORTANT NOTE:
// Deep testing of on-chain edge cases, race conditions and security enforcement
// is performed on the dvote-solidity repository specs
// 
// https://github.com/vocdoni/dvote-solidity/tree/master/test

import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import { getAccounts, increaseTimestamp, TestAccount } from "../testing-eth-utils"
import { VotingProcessContractMethods } from "dvote-solidity"
const fs = require("fs")


import { deployVotingProcessContract, getVotingProcessInstance } from "../../src/net/contracts"
import VotingProcessBuilder, {
    DEFAULT_METADATA_CONTENT_HASHED_URI,
    DEFAULT_MERKLE_ROOT,
    DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI
} from "../builders/voting-process"
import { BigNumber } from "ethers/utils"
import { checkValidProcessMetadata, ProcessMetadataTemplate } from "../../src/models/voting-process";

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let processId: string
let contractInstance: VotingProcessContractMethods & Contract

addCompletionHooks()

describe("Voting Process", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
        randomAccount1 = accounts[3]
        randomAccount2 = accounts[4]

        contractInstance = await new VotingProcessBuilder().build()
        processId = await contractInstance.getProcessId(entityAccount.address, 0)
    })

    describe("Smart Contract", () => {

        it("Should deploy the smart contract", async () => {
            contractInstance = await deployVotingProcessContract({ provider: entityAccount.provider, wallet: entityAccount.wallet }, [123])

            expect(contractInstance).to.be.ok
            expect(contractInstance.address.match(/^0x[0-9a-fA-F]{40}$/)).to.be.ok
        })

        it("Should attach to a given instance and deal with the same data", async () => {
            // set custom data on a deployed instance
            expect(contractInstance.address).to.be.ok
            const customProcessId = await contractInstance.getNextProcessId(entityAccount.address)

            await contractInstance.create(DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)

            // attach from a new object

            const newInstance = await getVotingProcessInstance({ provider: entityAccount.provider }, contractInstance.address)
            expect(newInstance.address).to.equal(contractInstance.address)

            const data = await newInstance.get(customProcessId)
            expect(data.metadata.toLowerCase()).to.equal(DEFAULT_METADATA_CONTENT_HASHED_URI)
            expect(data.censusMerkleRoot).to.equal(DEFAULT_MERKLE_ROOT)
            expect(data.censusMerkleTree).to.equal(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
            expect(data.entityAddress).to.equal(entityAccount.address)
            expect(data.voteEncryptionPrivateKey).to.equal("")
            expect(data.canceled).to.equal(false)
        })

        // it("Should compute process ID's in the same way as the on-chain version", async () => {
        //     const indexes = []
        //     for (let i = 0; i < 30; i++) {
        //         indexes.push(Math.round(Math.random() * 1000000000))
        //     }

        //     for (let account of accounts.filter(() => Math.random() >= 0.5)) {
        //         for (let index of indexes) {
        //             let expected = getProcessId(account.address, index)
        //             let received = await contractInstance.getProcessId(account.address, index)
        //             expect(received).to.equal(expected)
        //         }
        //     }
        // }).timeout(5000)

        it("The getProcessId() should match getNextProcessId()", async () => {
            // entityAddress has one process created by default from the builder
            expect(await contractInstance.getNextProcessId(entityAccount.address)).to.equal(await contractInstance.getProcessId(entityAccount.address, 1))

            // randomAccount has no process yet
            expect(await contractInstance.getNextProcessId(randomAccount.address)).to.equal(await contractInstance.getProcessId(randomAccount.address, 0))
        })

        it("Should work for any creator account", async () => {
            processId = await contractInstance.getNextProcessId(randomAccount.address)
            const builder = new VotingProcessBuilder()

            contractInstance = await builder.withEntityAccount(randomAccount).build()
            expect((await contractInstance.get(processId)).entityAddress).to.eq(randomAccount.address)

            contractInstance = await builder.withEntityAccount(randomAccount2).build()
            expect((await contractInstance.get(processId)).entityAddress).to.eq(randomAccount2.address)
        })

    })

    describe("Process creation", () => {

        it("Should allow to create voting processess", async () => {
            const metadata = "ipfs://ipfs/yyyyyyyyyyyy,https://host/file!0987654321"
            const merkleRoot = "0x09876543210987654321"
            const merkleTree = "ipfs://ipfs/zzzzzzzzzzz,https://host/file!1234567812345678"

            processId = await contractInstance.getNextProcessId(entityAccount.address)

            await contractInstance.create(metadata, merkleRoot, merkleTree)

            const data = await contractInstance.get(processId)
            expect(data.entityAddress).to.equal(entityAccount.address)
            expect(data.metadata).to.equal(metadata)
            expect(data.censusMerkleRoot).to.equal(merkleRoot)
            expect(data.censusMerkleTree).to.equal(merkleTree)
            expect(data.voteEncryptionPrivateKey).to.equal("")
            expect(data.canceled).to.equal(false)
        })

        it("Should notify creation events", async () => {
            processId = await contractInstance.getNextProcessId(entityAccount.address)

            const result: { entityAddress: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ProcessCreated", (entityAddress: string, processId: string) => {
                    resolve({ entityAddress, processId })
                })
                contractInstance.create(DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
                    .catch(reject)
            })

            expect(result.entityAddress).to.equal(entityAccount.address)
            expect(result.processId).to.equal(processId)
        }).timeout(8000)

    })

    describe("Process cancelation", () => {

        it("Should allow to cancel processes", async () => {
            const tx = await contractInstance.cancel(processId)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const data = await contractInstance.get(processId)
            expect(data.entityAddress).to.equal(entityAccount.address)
            expect(data.metadata).to.equal(DEFAULT_METADATA_CONTENT_HASHED_URI)
            expect(data.censusMerkleRoot).to.equal(DEFAULT_MERKLE_ROOT)
            expect(data.censusMerkleTree).to.equal(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
            expect(data.voteEncryptionPrivateKey).to.equal("")
            expect(data.canceled).to.equal(true)
        })

        it("Should notify event cancelation", async () => {
            const result: { entityAddress: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ProcessCanceled", (entityAddress: string, processId: string) => {
                    resolve({ entityAddress, processId })
                })
                contractInstance.cancel(processId).catch(reject)
            })

            expect(result.entityAddress).to.equal(entityAccount.address)
            expect(result.processId).to.equal(processId)
        }).timeout(8000)
    })

    describe("Genesis info", () => {
        it("Should allow to set the genesis Content Hashed URI", async () => {
            const genesis = "ipfs://12341234!56785678"

            const tx = await contractInstance.setGenesis(genesis)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const data = await contractInstance.getGenesis()
            expect(data).to.equal(genesis)
        })

        it("Should notify the event", async () => {
            const genesis = "ipfs://12341234!56785678"

            const result: { genesis: string } = await new Promise((resolve, reject) => {
                contractInstance.on("GenesisChanged", (genesis: string) => {
                    resolve({ genesis })
                })
                contractInstance.setGenesis(genesis).catch(reject)
            })

            expect(result.genesis).to.equal(genesis)
        }).timeout(8000)
    })

    describe("Chain ID", () => {
        it("Should allow to set the Chain ID", async () => {
            const chainId = 1234

            let tx = await contractInstance.setChainId(chainId)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            let data = await contractInstance.getChainId()
            expect(data.toNumber()).to.equal(chainId)
        })

        it("Should notify the event", async () => {
            const chainId = 1234

            const result: { chainId: BigNumber } = await new Promise((resolve, reject) => {
                contractInstance.on("ChainIdChanged", (chainId: BigNumber) => {
                    resolve({ chainId })
                })
                contractInstance.setChainId(chainId).catch(reject)
            })

            expect(result.chainId.toNumber()).to.equal(chainId)
        }).timeout(8000)
    })

    describe("Validator addition", () => {

        it("Should allow to add validators", async () => {
            const publicKey1 = "0x123456"
            const publicKey2 = "0x234567"

            // add one
            const tx = await contractInstance.addValidator(publicKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const result1 = await contractInstance.getValidators()
            expect(result1).to.deep.equal([publicKey1])

            // add another one
            const tx2 = await contractInstance.addValidator(publicKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)

            const result3 = await contractInstance.getValidators()
            expect(result3).to.deep.equal([publicKey1, publicKey2])
        })

        it("Should notify about validators added to a process", async () => {
            const publicKey1 = "0x123456"

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorAdded", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.addValidator(publicKey1).catch(reject)
            })

            expect(result.validatorPublicKey).to.equal(publicKey1)
        }).timeout(8000)
    })

    describe("Removing validators", () => {
        it("Should allow to remove a Validator", async () => {
            const publicKey1 = "0x123456"
            const publicKey2 = "0x234567"

            contractInstance = await new VotingProcessBuilder()
                .build()

            // add some
            await contractInstance.addValidator(publicKey1)
            await contractInstance.addValidator(publicKey2)

            // remove one
            const tx = await contractInstance.removeValidator(0, publicKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const result1 = await contractInstance.getValidators()
            expect(result1).to.deep.equal([publicKey2])

            // remove the other one
            const tx2 = await contractInstance.removeValidator(0, publicKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)

            const result2 = await contractInstance.getValidators()
            expect(result2).to.deep.equal([])
        })

        it("Should notify about Validators removed", async () => {
            const publicKey1 = "0x123456"

            contractInstance = await new VotingProcessBuilder()
                .build()

            await contractInstance.addValidator(publicKey1)

            const result: { validatorPublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ValidatorRemoved", (validatorPublicKey: string) => {
                    resolve({ validatorPublicKey })
                })
                contractInstance.removeValidator(0, publicKey1).catch(reject)
            })

            expect(result.validatorPublicKey).to.equal(publicKey1)
        }).timeout(8000)
    })

    describe("Oracle addition", () => {

        it("Should allow to add oracles", async () => {
            const publicKey1 = "0x123456"
            const publicKey2 = "0x234567"

            // add one
            const tx = await contractInstance.addOracle(publicKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const result1 = await contractInstance.getOracles()
            expect(result1).to.deep.equal([publicKey1])

            // add another one
            const tx2 = await contractInstance.addOracle(publicKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)

            const result3 = await contractInstance.getOracles()
            expect(result3).to.deep.equal([publicKey1, publicKey2])
        })

        it("Should notify about oracles added to a process", async () => {
            const publicKey1 = "0x123456"

            const result: { oraclePublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleAdded", (oraclePublicKey: string) => {
                    resolve({ oraclePublicKey })
                })
                contractInstance.addOracle(publicKey1).catch(reject)
            })

            expect(result.oraclePublicKey).to.equal(publicKey1)
        }).timeout(8000)
    })

    describe("Removing oracles", () => {
        it("Should allow to remove an Oracle", async () => {
            const publicKey1 = "0x123456"
            const publicKey2 = "0x234567"

            contractInstance = await new VotingProcessBuilder()
                .build()

            // add some
            await contractInstance.addOracle(publicKey1)
            await contractInstance.addOracle(publicKey2)

            // remove one
            const tx = await contractInstance.removeOracle(0, publicKey1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const result1 = await contractInstance.getOracles()
            expect(result1).to.deep.equal([publicKey2])

            // remove the other one
            const tx2 = await contractInstance.removeOracle(0, publicKey2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)

            const result2 = await contractInstance.getOracles()
            expect(result2).to.deep.equal([])
        })

        it("Should notify about oracles removed on a process", async () => {
            const publicKey1 = "0x123456"

            contractInstance = await new VotingProcessBuilder()
                .build()

            await contractInstance.addOracle(publicKey1)

            const result: { oraclePublicKey: string } = await new Promise((resolve, reject) => {
                contractInstance.on("OracleRemoved", (oraclePublicKey: string) => {
                    resolve({ oraclePublicKey })
                })
                contractInstance.removeOracle(0, publicKey1).catch(reject)
            })

            expect(result.oraclePublicKey).to.equal(publicKey1)
        }).timeout(8000)
    })

    describe("Decryption key publishing", () => {

        it("Should allow to reveal the decryption key", async () => {
            // created by the entity
            contractInstance = await new VotingProcessBuilder()
                .withEntityAccount(entityAccount)
                .build()

            const result1 = await contractInstance.getPrivateKey(processId)
            expect(result1).to.equal("")

            const tx1 = await contractInstance.publishPrivateKey(processId, "1234-5678")
            expect(tx1).to.be.ok
            expect(tx1.to).to.equal(contractInstance.address)

            const result2 = await contractInstance.getPrivateKey(processId)
            expect(result2).to.equal("1234-5678")
        })

        it("Should notify about decryption keys revealed", async () => {
            const result: { privateKey: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("PrivateKeyPublished", (processId: string, privateKey: string) => {
                    resolve({ processId, privateKey })
                })

                return contractInstance.publishPrivateKey(processId, "1234-5678").catch(reject)
            })

            expect(result.processId).to.equal(processId)
            expect(result.privateKey).to.equal("1234-5678")
        }).timeout(8000)
    })

    describe("Results publishing", () => {

        it("Should allow to publish the results", async () => {
            // created by the entity
            contractInstance = await new VotingProcessBuilder()
                .withEntityAccount(entityAccount)
                .build()

            const result1 = await contractInstance.getResults(processId)
            expect(result1).to.equal("")

            const tx1 = await contractInstance.publishPrivateKey(processId, "hello-world")
            await tx1.wait()

            const tx2 = await contractInstance.publishResults(processId, "1234-5678")
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)
            await tx2.wait()

            const result2 = await contractInstance.getResults(processId)
            expect(result2).to.equal("1234-5678")
        })

        it("Should notify about results published", async () => {
            const result: { results: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ResultsPublished", (processId: string, results: string) => {
                    resolve({ processId, results })
                })

                return contractInstance.publishPrivateKey(processId, "hello-world").then(() =>
                    contractInstance.publishResults(processId, "1234-5678")
                ).catch(reject)
            })

            expect(result.processId).to.equal(processId)
            expect(result.results).to.equal("1234-5678")
        }).timeout(8000)
    })

    describe("Census keys derivation", () => {
        it("Should derive a keypair with a processId")
        it("Should be able to sign with a derived private key")
        it("Should produce valid signatures that match with the derived public key")
    })

    // describe("Linkable Ring Signatures", () => {
    //     it("Should produce a ring signature using a private key and a ring of public keys")
    //     it("Should allow to verify that a valid signature is within a public key ring")
    //     it("Should deny the validity of a signature produced by key that don't belong to the given ring")
    //     it("Should link two signatures that have been issued with the same key pair")
    //     it("Should not link two signatures that have been issued with different key pairs")
    //     it("Should bundle a Vote Package into a valid Vote Envelope that only the chosen relay can decrypt")
    // })

    describe("ZK Snarks", () => {
        it("Should produce a valid ZK proof if the user is eligible to vote in an election")
        it("Should allow to verify that a ZK proof is valid")
        it("Should bundle a Vote Package into a valid Vote Envelope that only the chosen relay can decrypt")
    })

    describe("Metadata validator", () => {
        it("Should accept a valid Process Metadata JSON", () => {
            const processMetadata = fs.readFileSync(__dirname + "/../../example/process-metadata.json")

            expect(() => {
                checkValidProcessMetadata(JSON.parse(processMetadata))
            }).to.not.throw

            expect(() => {
                checkValidProcessMetadata(ProcessMetadataTemplate)
            }).to.not.throw
        })

        it("Should reject invalid Process Metadata JSON payloads", () => {
            // Totally invalid
            expect(() => {
                const payload = JSON.parse('{"test": 123}')
                checkValidProcessMetadata(payload)
            }).to.throw

            expect(() => {
                const payload = JSON.parse('{"name": {"default": "hello", "fr": "Alô"}}')
                checkValidProcessMetadata(payload)
            }).to.throw

            // Incomplete fields
            const processMetadata = fs.readFileSync(__dirname + "/../../example/process-metadata.json")

            expect(() => { checkValidProcessMetadata(Object.assign({}, processMetadata, { version: null })) }).to.throw
            expect(() => { checkValidProcessMetadata(Object.assign({}, processMetadata, { type: null })) }).to.throw
            expect(() => { checkValidProcessMetadata(Object.assign({}, processMetadata, { startBlock: null })) }).to.throw
            expect(() => { checkValidProcessMetadata(Object.assign({}, processMetadata, { numberOfBlocks: null })) }).to.throw
            expect(() => { checkValidProcessMetadata(Object.assign({}, processMetadata, { census: null })) }).to.throw
            expect(() => { checkValidProcessMetadata(Object.assign({}, processMetadata, { details: null })) }).to.throw

        })
    })
})
