// IMPORTANT NOTE:
// Deep testing of on-chain edge cases, race conditions and security enforcement
// is performed on the dvote-solidity repository specs
// 
// https://github.com/vocdoni/dvote-solidity/tree/master/test

import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract, Wallet } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import { getAccounts, increaseTimestamp, TestAccount } from "../testing-eth-utils"
import { VotingProcessContractMethods } from "dvote-solidity"
const fs = require("fs")

import { deployVotingProcessContract, getVotingProcessInstance } from "../../src/net/contracts"
import { getPollNullifier } from "../../src/api/vote"
import { checkValidProcessMetadata } from "../../src/models/voting-process"
import VotingProcessBuilder, {
    DEFAULT_PROCESS_TYPE,
    DEFAULT_METADATA_CONTENT_HASHED_URI,
    DEFAULT_MERKLE_ROOT,
    DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI,
    DEFAULT_NUMBER_OF_BLOCKS,
    DEFAULT_START_BLOCK
} from "../builders/voting-process"
import ProcessMetadataBuilder from  "../builders/voting-process-metadata"
import { BigNumber } from "ethers/utils"

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

            await contractInstance.create(DEFAULT_PROCESS_TYPE, DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI,
                DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS)

            // attach from a new object

            const newInstance = await getVotingProcessInstance({ provider: entityAccount.provider }, contractInstance.address)
            expect(newInstance.address).to.equal(contractInstance.address)

            const data = await newInstance.get(customProcessId)
            expect(data.processType.toLowerCase()).to.equal(DEFAULT_PROCESS_TYPE)
            expect(data.metadata.toLowerCase()).to.equal(DEFAULT_METADATA_CONTENT_HASHED_URI)
            expect(data.censusMerkleRoot).to.equal(DEFAULT_MERKLE_ROOT)
            expect(data.censusMerkleTree).to.equal(DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI)
            expect(data.entityAddress).to.equal(entityAccount.address)
            expect(data.voteEncryptionPrivateKey).to.equal("")
            expect(data.canceled).to.equal(false)
            expect(data.startBlock.toNumber()).to.equal(DEFAULT_START_BLOCK)
            expect(data.numberOfBlocks.toNumber()).to.equal(DEFAULT_NUMBER_OF_BLOCKS)
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
            const procType = "poll-vote"
            const metadata = "ipfs://yyyyyyyyyyyy,https://host/file!0987654321"
            const merkleRoot = "0x09876543210987654321"
            const merkleTree = "ipfs://zzzzzzzzzzz,https://host/file!1234567812345678"
            const startBlock = 12341234
            const numberOfBlocks = 500000

            processId = await contractInstance.getNextProcessId(entityAccount.address)

            await contractInstance.create(procType, metadata, merkleRoot, merkleTree, startBlock, numberOfBlocks)

            const data = await contractInstance.get(processId)
            expect(data.processType).to.equal(procType)
            expect(data.entityAddress).to.equal(entityAccount.address)
            expect(data.metadata).to.equal(metadata)
            expect(data.censusMerkleRoot).to.equal(merkleRoot)
            expect(data.censusMerkleTree).to.equal(merkleTree)
            expect(data.voteEncryptionPrivateKey).to.equal("")
            expect(data.canceled).to.equal(false)
            expect(data.startBlock.toNumber()).to.equal(startBlock)
            expect(data.numberOfBlocks.toNumber()).to.equal(numberOfBlocks)
        })

        it("Should notify creation events", async () => {
            // Skip the event of the process created by beforeEach()
            const prevProcessId = await contractInstance.getProcessId(entityAccount.address, 0)
            processId = await contractInstance.getNextProcessId(entityAccount.address)

            const result: { entityAddress: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ProcessCreated", (entityAddress: string, processId: string) => {
                    if (processId === prevProcessId) return // skip the previous process's event
                    resolve({ entityAddress, processId })
                })
                contractInstance.create(DEFAULT_PROCESS_TYPE, DEFAULT_METADATA_CONTENT_HASHED_URI, DEFAULT_MERKLE_ROOT, DEFAULT_MERKLE_TREE_CONTENT_HASHED_URI,
                    DEFAULT_START_BLOCK, DEFAULT_NUMBER_OF_BLOCKS)
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
    //     it("Should bundle a Vote Package into a valid Vote Envelope")
    // })

    describe("ZK Snarks", () => {
        it("Should produce a valid ZK proof if the user is eligible to vote in an election")
        it("Should allow to verify that a ZK proof is valid")
        it("Should bundle a Vote Package into a valid Vote Envelope")
    })

    describe("Polls", () => {
        it("Should retrieve a valid merkle proof if the user is eligible to vote in an election")
        it("Should compute valid poll nullifiers", () => {
            const processId = "0x8b35e10045faa886bd2e18636cd3cb72e80203a04e568c47205bf0313a0f60d1"

            const wallet = Wallet.fromMnemonic("seven family better journey display approve crack burden run pattern filter topple")
            expect(wallet.privateKey).to.eq("0xdc44bf8c260abe06a7265c5775ea4fb68ecd1b1940cfa76c1726141ec0da5ddc")
            expect(wallet.address).to.eq("0xaDDAa28Fb1fe87362A6dFdC9d3EEA03d0C221d81")

            let nullifier = getPollNullifier(wallet.address, processId)
            expect(nullifier).to.eq("0xf6e3fe2d68f3ccc3af2a7835b302e42c257e2de6539c264542f11e5588e8c162")

            nullifier = getPollNullifier(baseAccount.address, processId)
            expect(nullifier).to.eq("0x13bf966813b5299110d34b1e565d62d8c26ecb1f76f92ca8bd21fd91600360bc")

            nullifier = getPollNullifier(randomAccount.address, processId)
            expect(nullifier).to.eq("0x25e1ec205509664e2433b9f9930c901eb1f2e31e851468a6ef7329dd9ada3bc8")

            nullifier = getPollNullifier(randomAccount1.address, processId)
            expect(nullifier).to.eq("0x419761e28c5103fa4ddac3d575a940c683aa647c31a8ac1073c8780f4664efcb")
        })
        it("Should bundle a Vote Package into a valid Vote Envelope")
    })

    describe("Metadata validator", () => {

        it("Should accept a valid Process Metadata JSON", () => {
            const processMetadata = new ProcessMetadataBuilder().build()
            expect(() => {
                checkValidProcessMetadata(processMetadata)
            }).to.not.throw()
        })

        it("Should reject a non valid Process Metadata JSON", () => {
            const processMetadata = new ProcessMetadataBuilder().get()
            expect(() => {
                checkValidProcessMetadata(processMetadata)
            }).to.throw()
        })

        it("Should accept an integer vote value", () => {
            const payload  = new ProcessMetadataBuilder().withIntegerVoteValues().build()
            expect(() => {
                checkValidProcessMetadata(payload)
            }).to.not.throw()
        })

        it("Should accept a string vote value", () => {
            const payload  = new ProcessMetadataBuilder().withStringVoteValues().build()
            expect(() => {
                checkValidProcessMetadata(payload)
            }).to.not.throw()
        })

        it("Should convert a string value vote to integer in the Process Metadata JSON", () => {
            const payload  = new ProcessMetadataBuilder().withStringVoteValues().build()
            const result = checkValidProcessMetadata(payload)
            expect(result.details.questions[0].voteOptions[0].value).to.be.a("number")
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
                processMetadata.details.questions[0].voteOptions[0].value = "a"
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
                checkValidProcessMetadata(Object.assign({}, processMetadata, { type: null }))
            }).to.throw()
            expect(() => {
                checkValidProcessMetadata(Object.assign({}, processMetadata, { startBlock: null }))
            }).to.throw()
            expect(() => {
                checkValidProcessMetadata(Object.assign({}, processMetadata, { numberOfBlocks: null }))
            }).to.throw()
            expect(() => {
                checkValidProcessMetadata(Object.assign({}, processMetadata, { census: null }))
            }).to.throw()
            expect(() => {
                checkValidProcessMetadata(Object.assign({}, processMetadata, { details: null }))
            }).to.throw()
        })

        it("Should accept big number of questions", () => {
            const processMetadata = new ProcessMetadataBuilder().withNumberOfQuestions(500).build()
            expect(() => {
                checkValidProcessMetadata(processMetadata)
            }).to.not.throw()

            const result = checkValidProcessMetadata(processMetadata)
            expect(result.details.questions.length).to.equal(500)
        }).timeout(1500)

        it("Should accept big number of options", () => {
            const processMetadata = new ProcessMetadataBuilder().withNumberOfOptions(500)
            expect(() => {
                checkValidProcessMetadata(processMetadata)
            }).to.not.throw()

            const result = checkValidProcessMetadata(processMetadata)
            expect(result.details.questions[0].voteOptions.length).to.equal(500)
        }).timeout(1500)
    })
})
