// IMPORTANT NOTE:
// Deep testing of on-chain edge cases, race conditions and security enforcement
// is performed on the dvote-solidity repository specs
// 
// https://github.com/vocdoni/dvote-solidity/tree/master/test

import "mocha" // using @types/mocha
import { expect } from "chai"
import { Contract } from "ethers"
import { addCompletionHooks } from "../mocha-hooks"
import { getAccounts, increaseTimestamp, TestAccount } from "../eth-util"
import { VotingProcessInstance } from "dvote-solidity"


import VotingProcess from "../../src/dvote/voting-process"
import VotingProcessBuilder, {
    DEFAULT_NAME,
    DEFAULT_METADATA_CONTENT_URI,
    DEFAULT_START_TIME_PADDING,
    DEFAULT_END_TIME_PADDING,
    DEFAULT_VOTING_PUBLIC_KEY
} from "../builders/voting-process"
import { BigNumber } from "ethers/utils";

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let relayAccount1: TestAccount
let relayAccount2: TestAccount
let processId: string
let contractInstance: VotingProcessInstance | Contract

addCompletionHooks()

describe("Voting Process", () => {
    beforeEach(async () => {
        accounts = getAccounts()
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
        relayAccount1 = accounts[3]
        relayAccount2 = accounts[4]

        contractInstance = await new VotingProcessBuilder().build()
        processId = await VotingProcess.getProcessId(entityAccount.address, 0)
    })

    describe("Smart Contract", () => {

        it("Should deploy the smart contract", async () => {
            const factory = new VotingProcess({
                provider: entityAccount.provider,
                privateKey: entityAccount.privateKey
            })
            contractInstance = await factory.deploy()

            expect(contractInstance).to.be.ok
            expect(contractInstance.address.match(/^0x[0-9a-fA-F]{40}$/)).to.be.ok
        })

        it("Should attach to a given instance and deal with the same data", async () => {
            // set custom data on a deployed instance
            expect(contractInstance.address).to.be.ok
            const customProcessId = await contractInstance.getNextProcessId(entityAccount.address)
            const resolverAddress = "0x00f8bf6a479f320ead074411a4b0e7944ea8c9c1"
            const name = "A custom process name here"
            const customMetadataUri = "bzz://xxxxxxxx,ipfs://ipfs/xxxxxxxx"
            const startTime = Math.floor(Date.now() / 1000) + 60
            const endTime = Math.floor(Date.now() / 1000) + 120
            const customPublicKey = "0x2345"

            await contractInstance.create(resolverAddress, name, customMetadataUri, startTime, endTime, customPublicKey)

            // attach from a new object
            const vProcess = new VotingProcess({ provider: entityAccount.provider, privateKey: entityAccount.privateKey })
            const newInstance = vProcess.attach(contractInstance.address)
            expect(newInstance.address).to.equal(contractInstance.address)

            const data = await newInstance.get(customProcessId)
            expect(data.entityResolver.toLowerCase()).to.equal(resolverAddress)
            expect(data.entityAddress).to.equal(entityAccount.address)
            expect(data.processName).to.equal(name)
            expect(data.metadataContentUri).to.equal(customMetadataUri)
            expect(data.startTime.toNumber()).to.equal(startTime)
            expect(data.endTime.toNumber()).to.equal(endTime)
            expect(data.voteEncryptionPublicKey).to.equal(customPublicKey)
            expect(data.canceled).to.equal(false)

            expect(newInstance).to.equal(vProcess.deployed())
        })

        it("Should compute process ID's in the same way as the on-chain version", async () => {
            const indexes = []
            for (let i = 0; i < 30; i++) {
                indexes.push(Math.round(Math.random() * 1000000000))
            }

            for (let account of accounts.filter(() => Math.random() >= 0.5)) {
                for (let index of indexes) {
                    let expected = VotingProcess.getProcessId(account.address, index)
                    let received = await contractInstance.getProcessId(account.address, index)
                    expect(received).to.equal(expected)
                }
            }
        }).timeout(5000)

        it("The getProcessId() should match getNextProcessId()", async () => {
            // entityAddress has one process created by default from the builder
            expect(await contractInstance.getNextProcessId(entityAccount.address)).to.equal(VotingProcess.getProcessId(entityAccount.address, 1))

            // randomAccount has no process yet
            expect(await contractInstance.getNextProcessId(randomAccount.address)).to.equal(VotingProcess.getProcessId(randomAccount.address, 0))
        })

        it("Should work for any creator account", async () => {
            processId = await contractInstance.getNextProcessId(randomAccount.address)
            const builder = new VotingProcessBuilder()

            contractInstance = await builder.withEntityAccount(randomAccount).build()
            expect((await contractInstance.get(processId)).processName).to.eq(DEFAULT_NAME)

            contractInstance = await builder.withEntityAccount(randomAccount).withName("VOTING PROCESS HERE").build()
            expect((await contractInstance.get(processId)).processName).to.eq("VOTING PROCESS HERE")
        })

    })

    describe("Process creation", () => {

        it("Should allow to create voting processess", async () => {
            const resolverAddress = "0x0123456789012345678901234567890123456789"
            const name = "Test process"
            const metadataUri = "bzz://yyyyyyyyyyyy,ipfs://ipfs/yyyyyyyyyyyy"
            const startTime = Math.floor(Date.now() / 1000) + 150
            const endTime = Math.floor(Date.now() / 1000) + 250
            const publicKey = "0x3456"

            processId = await contractInstance.getNextProcessId(entityAccount.address)

            await contractInstance.create(resolverAddress, name, metadataUri, startTime, endTime, publicKey)

            const data = await contractInstance.get(processId)
            expect(data.entityResolver.toLowerCase()).to.equal(resolverAddress)
            expect(data.entityAddress).to.equal(entityAccount.address)
            expect(data.processName).to.equal(name)
            expect(data.metadataContentUri).to.equal(metadataUri)
            expect(data.startTime.toNumber()).to.equal(startTime)
            expect(data.endTime.toNumber()).to.equal(endTime)
            expect(data.voteEncryptionPublicKey).to.equal(publicKey)
            expect(data.canceled).to.equal(false)
        })

        it("Should report creation events", async () => {
            const resolverAddress = "0x1234567890123456789012345678901234567890"
            const name = "Test process 2"
            const metadataUri = "bzz://zzzzzzzz,ipfs://ipfs/zzzzzzzz"
            const startTime = Math.floor(Date.now() / 1000) + 1500
            const endTime = Math.floor(Date.now() / 1000) + 2500
            const publicKey = "0x4567"

            processId = await contractInstance.getNextProcessId(entityAccount.address)

            const result: { entityAddress: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("ProcessCreated", (entityAddress: string, processId: string) => {
                    resolve({ entityAddress, processId })
                })
                contractInstance.create(resolverAddress, name, metadataUri, startTime, endTime, publicKey)
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
            expect(data.processName).to.equal(DEFAULT_NAME)
            expect(data.metadataContentUri).to.equal(DEFAULT_METADATA_CONTENT_URI)
            expect(data.voteEncryptionPublicKey).to.equal(DEFAULT_VOTING_PUBLIC_KEY)
            expect(data.canceled).to.equal(true)
        })

        it("Should report event cancelation", async () => {
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

    describe("Relay addition", () => {

        it("Should allow to add relays", async () => {
            const publicKey1 = "0x123456"
            const publicKey2 = "0x234567"
            const messagingUri1 = "pss://1234@5678"
            const messagingUri2 = "pubsub://1234#5678"

            // add one
            const tx = await contractInstance.addRelay(processId, relayAccount1.address, publicKey1, messagingUri1)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const result1 = await contractInstance.getRelayIndex(processId)
            expect(result1).to.deep.equal([relayAccount1.address])
            expect(await contractInstance.isActiveRelay(processId, relayAccount1.address)).to.equal(true)

            const result2 = await contractInstance.getRelay(processId, relayAccount1.address)
            expect(result2.publicKey).to.equal(publicKey1)
            expect(result2.messagingUri).to.equal(messagingUri1)

            // add another one
            const tx2 = await contractInstance.addRelay(processId, relayAccount2.address, publicKey2, messagingUri2)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)

            const result3 = await contractInstance.getRelayIndex(processId)
            expect(result3).to.deep.equal([relayAccount1.address, relayAccount2.address])
            expect(await contractInstance.isActiveRelay(processId, relayAccount2.address)).to.equal(true)

            const result4 = await contractInstance.getRelay(processId, relayAccount2.address)
            expect(result4.publicKey).to.equal(publicKey2)
            expect(result4.messagingUri).to.equal(messagingUri2)
        })

        it("Should report about relays added to a process", async () => {
            const result: { relayAddress: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("RelayAdded", (processId: string, relayAddress: string) => {
                    resolve({ relayAddress, processId })
                })
                contractInstance.addRelay(processId, relayAccount1.address, "0x1234", "pss://1234@2345").catch(reject)
            })

            expect(result.processId).to.equal(processId)
            expect(result.relayAddress).to.equal(relayAccount1.address)
        }).timeout(8000)

    })

    describe("Disabling relays", () => {

        it("Should allow to disable a relay", async () => {
            const publicKey1 = "0x123456"
            const publicKey2 = "0x234567"
            const messagingUri1 = "pss://1234@5678"
            const messagingUri2 = "pubsub://1234#5678"

            contractInstance = await new VotingProcessBuilder()
                .withRelay(relayAccount1.address, publicKey1, messagingUri1)
                .withRelay(relayAccount2.address, publicKey2, messagingUri2)
                .build()

            // remove one
            const tx = await contractInstance.disableRelay(processId, relayAccount1.address)
            expect(tx).to.be.ok
            expect(tx.to).to.equal(contractInstance.address)

            const result1 = await contractInstance.getRelayIndex(processId)
            expect(result1).to.deep.equal([relayAccount2.address])
            expect(await contractInstance.isActiveRelay(processId, relayAccount1.address)).to.equal(false)

            const result2 = await contractInstance.getRelay(processId, relayAccount1.address)
            expect(result2.publicKey).to.equal(publicKey1)
            expect(result2.messagingUri).to.equal(messagingUri1)

            // remove the other one
            const tx2 = await contractInstance.disableRelay(processId, relayAccount2.address)
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(contractInstance.address)

            const result3 = await contractInstance.getRelayIndex(processId)
            expect(result3).to.deep.equal([])
            expect(await contractInstance.isActiveRelay(processId, relayAccount2.address)).to.equal(false)

            const result4 = await contractInstance.getRelay(processId, relayAccount2.address)
            expect(result4.publicKey).to.equal(publicKey2)
            expect(result4.messagingUri).to.equal(messagingUri2)
        })

        it("Should report about relays disabled on a process", async () => {
            const publicKey1 = "0x123456"
            const messagingUri1 = "pss://1234@5678"

            contractInstance = await new VotingProcessBuilder()
                .withRelay(relayAccount1.address, publicKey1, messagingUri1)
                .build()

            const result: { relayAddress: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("RelayAdded", (processId: string, relayAddress: string) => {
                    resolve({ relayAddress, processId })
                })
                contractInstance.disableRelay(processId, relayAccount1.address).catch(reject)
            })

            expect(result.processId).to.equal(processId)
            expect(result.relayAddress).to.equal(relayAccount1.address)
        }).timeout(8000)

    })

    describe("Registering vote batches", () => {

        it("Should allow to register a vote batch", async () => {
            // created by the entity
            contractInstance = await new VotingProcessBuilder()
                .withRelay(relayAccount1.address)
                .build()

            await increaseTimestamp(DEFAULT_START_TIME_PADDING + 2)

            // attach from a relay's account
            const vProcess = new VotingProcess({ provider: relayAccount1.provider, privateKey: relayAccount1.privateKey })
            const relayContractInstance = vProcess.attach(contractInstance.address)

            // add one
            const result1 = await contractInstance.getVoteBatchCount(processId)
            expect(result1.toNumber()).to.equal(0)

            const tx1 = await relayContractInstance.registerVoteBatch(processId, "bzz://1234")
            expect(tx1).to.be.ok
            expect(tx1.to).to.equal(relayContractInstance.address)

            const result2 = await contractInstance.getVoteBatchCount(processId)
            expect(result2.toNumber()).to.equal(1)

            const result3 = await contractInstance.getBatch(processId, 0)
            expect(result3).to.equal("bzz://1234")

            // add another one
            const result4 = await contractInstance.getVoteBatchCount(processId)
            expect(result4.toNumber()).to.equal(1)

            const tx2 = await relayContractInstance.registerVoteBatch(processId, "ipfs://ipfs/2345")
            expect(tx2).to.be.ok
            expect(tx2.to).to.equal(relayContractInstance.address)

            const result5 = await contractInstance.getVoteBatchCount(processId)
            expect(result5.toNumber()).to.equal(2)

            const result6 = await contractInstance.getBatch(processId, 1)
            expect(result6).to.equal("ipfs://ipfs/2345")
        })

        it("Should report about vote batches added to a process", async () => {
            // created by the entity
            contractInstance = await new VotingProcessBuilder()
                .withRelay(relayAccount1.address)
                .build()

            const result: { batchNumber: BigNumber, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("BatchRegistered", (processId: string, batchNumber: BigNumber) => {
                    resolve({ processId, batchNumber })
                })

                increaseTimestamp(DEFAULT_START_TIME_PADDING + 2).then(() => {
                    // attach from a relay's account
                    const vProcess = new VotingProcess({ provider: relayAccount1.provider, privateKey: relayAccount1.privateKey })
                    const relayContractInstance = vProcess.attach(contractInstance.address)
                    return relayContractInstance.registerVoteBatch(processId, "ipfs://ipfs/1234")
                }).catch(reject)
            })

            expect(result.processId).to.equal(processId)
            expect(result.batchNumber.toNumber()).to.equal(0)
        }).timeout(8000)

    })

    describe("Revealing the private key", () => {

        it("Should allow to reveal the private key", async () => {
            // wait until the default process is ended
            await increaseTimestamp(DEFAULT_END_TIME_PADDING + 2)

            const privKey = "I_AM_THE_PRIV_KEY"

            const result1 = await contractInstance.getPrivateKey(processId)
            expect(result1).to.equal("")

            const tx = await contractInstance.revealPrivateKey(processId, privKey)
            await tx.wait()

            const result2 = await contractInstance.getPrivateKey(processId)
            expect(result2).to.equal(privKey)
        })

        it("Should report about vote batches added to a process", async () => {
            const privKey = "I_AM_THE_PRIV_KEY"

            const result: { privateKey: string, processId: string } = await new Promise((resolve, reject) => {
                contractInstance.on("PrivateKeyRevealed", (processId: string, privateKey: string) => {
                    resolve({ processId, privateKey })
                })

                increaseTimestamp(DEFAULT_END_TIME_PADDING + 2).then(() => {
                    return contractInstance.revealPrivateKey(processId, privKey)
                }).catch(reject)
            })

            expect(result.processId).to.equal(processId)
            expect(result.privateKey).to.equal(privKey)
        }).timeout(8000)

    })

})
