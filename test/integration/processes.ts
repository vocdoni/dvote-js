import "mocha" // using @types/mocha
import { expect } from "chai"
import DevServices, { TestAccount } from "../helpers/all-services"
// import NamespaceBuilder, { DEFAULT_NAMESPACE } from "../builders/namespace"
import { Contract, providers, Wallet } from "ethers"
import { ProcessesContractMethods, ProcessContractParameters, ProcessEnvelopeType, ProcessMode } from "../../src/net/contracts"
import ProcessBuilder, {
    DEFAULT_PROCESS_MODE,
    DEFAULT_ENVELOPE_TYPE,
    DEFAULT_CENSUS_ORIGIN,
    DEFAULT_METADATA_CONTENT_HASHED_URI,
    DEFAULT_CENSUS_ROOT,
    DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI,
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
import NamespaceBuilder from "../builders/namespace"
import { Web3Gateway } from "../../src/net/gateway-web3"
import GenesisBuilder, { DEFAULT_CHAIN_ID } from "../builders/genesis"
import ResultsBuilder from "../builders/results"
import { Voting } from "../../dist"

let server: DevServices

let accounts: TestAccount[]
let baseAccount: TestAccount
let entityAccount: TestAccount
let randomAccount: TestAccount
let randomAccount1: TestAccount
let randomAccount2: TestAccount
let processId: string
let contractInstance: ProcessesContractMethods & Contract
// let tx: ContractReceipt
let chainId: number

// function mockResolveName(input: string) {
//     switch (input) {
//         case "entities.voc.eth": return Promise.resolve(entityInstance.address)
//         case "namespaces.voc.eth": return processInstance.namespaceAddress()
//         case "erc20.proofs.voc.eth": return processInstance.tokenStorageProofAddress()
//         case "processes.voc.eth": return Promise.resolve(processInstance.address)
//     }
//     if (input.startsWith("0x")) return Promise.resolve(input)
//     return Promise.reject(new Error("Unrecognized input: " + input))
// }

describe("Process", () => {
    before(() => {
        server = new DevServices({ port: 9001 }, { port: 9002 })
        return server.start()
    })
    after(() => {
        return server.stop()
    })

    beforeEach(async () => {
        accounts = server.accounts
        baseAccount = accounts[0]
        entityAccount = accounts[1]
        randomAccount = accounts[2]
        randomAccount1 = accounts[3]
        randomAccount2 = accounts[4]

        await server.start()
        chainId = DEFAULT_CHAIN_ID
        contractInstance = await new ProcessBuilder(accounts).withChainId(chainId).build()
        processId = await contractInstance.getProcessId(entityAccount.address, 0, DEFAULT_NAMESPACE, chainId)
    })
    afterEach(() => server.stop())

    // it("example", async () => {
    //     const gatewayServer = new GatewayMock({
    //         port,
    //         responses: [
    //             { ok: true, request: "123", timestamp: 123, result: "OK 1" },
    //             { ok: true, request: "234", timestamp: 234, result: "OK 2" },
    //         ]
    //     })
    //     const gatewayInfo = new GatewayInfo(gatewayUri, ["file", "vote", "census"], "https://server/path", "")
    //     const gwClient = new DVoteGateway(gatewayInfo)
    //     await gwClient.connect()

    //     const response1 = await gwClient.sendRequest({ method: "addCensus", processId: "1234", nullifier: "2345" })
    //     const response2 = await gwClient.sendRequest({ method: "addClaim", processId: "3456", nullifier: "4567" })

    //     expect(response1.result).to.equal("OK 1")
    //     expect(response2.result).to.equal("OK 2")
    //     expect(gatewayServer.interactionCount).to.equal(5)
    //     expect(gatewayServer.interactionList[0].actual.request.method).to.equal("addCensus")
    //     expect(gatewayServer.interactionList[0].actual.request.processId).to.equal("1234")
    //     expect(gatewayServer.interactionList[0].actual.request.nullifier).to.equal("2345")
    //     expect(gatewayServer.interactionList[1].actual.request.method).to.equal("addClaim")
    //     expect(gatewayServer.interactionList[1].actual.request.processId).to.equal("3456")
    //     expect(gatewayServer.interactionList[1].actual.request.nullifier).to.equal("4567")
    //     expect(gatewayServer.interactionList[2].actual.request.method).to.equal("addClaimBulk")
    //     expect(gatewayServer.interactionList[2].actual.request.processId).to.equal("5678")
    //     expect(gatewayServer.interactionList[2].actual.request.nullifier).to.equal("6789")
    //     expect(gatewayServer.interactionList[3].actual.request.method).to.equal("fetchFile")
    //     expect(gatewayServer.interactionList[3].actual.request.uri).to.equal("12345")
    //     expect(gatewayServer.interactionList[4].actual.request.method).to.equal("fetchFile")
    //     expect(gatewayServer.interactionList[4].actual.request.uri).to.equal("67890")

    //     await gatewayServer.stop()
    // })

    describe("Smart Contract", () => {

        it("Should attach to a given instance and deal with the same data", async () => {
            // set custom data on a deployed instance
            expect(contractInstance.address).to.be.ok
            const newProcessId = await contractInstance.getNextProcessId(entityAccount.address)

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
            expect(data.censusRoot).to.equal(DEFAULT_CENSUS_ROOT)
            expect(data.censusUri).to.equal(DEFAULT_CENSUS_TREE_CONTENT_HASHED_URI)
            expect(data.entityAddress).to.equal(entityAccount.address)
            expect(data.status.isPaused).to.eq(true)
            expect(data.maxCount).to.eq(DEFAULT_MAX_COUNT)
            expect(data.maxValue).to.eq(DEFAULT_MAX_VALUE)
            expect(data.maxTotalCost).to.eq(DEFAULT_MAX_TOTAL_COST)
            expect(data.costExponent).to.eq(DEFAULT_COST_EXPONENT)
            expect(data.maxVoteOverwrites).to.eq(DEFAULT_MAX_VOTE_OVERWRITES)
            expect(data.paramsSignature).to.eq(null)  // Not retrieved by contract.get(...)
        })

        it("Should compute process ID's in the same way as the on-chain version", async () => {
            const indexes = []
            for (let i = 0; i < 30; i++) {
                indexes.push(Math.round(Math.random() * 1000000000))
            }

            for (let account of accounts.filter(() => Math.random() >= 0.5)) {
                for (let index of indexes) {
                    let expected = Voting.getProcessId(account.address, index, DEFAULT_NAMESPACE, chainId)
                    let received = await contractInstance.getProcessId(account.address, index, DEFAULT_NAMESPACE, chainId)
                    expect(received).to.equal(expected)
                }
            }
        }).timeout(10000)

        it("The getProcessId() should match getNextProcessId()", async () => {
            // entityAddress has one process created by default from the builder
            let namespaceId = await contractInstance.namespaceId()
            expect((await contractInstance.getEntityProcessCount(entityAccount.address)).toNumber()).to.eq(1)
            expect(await contractInstance.getNextProcessId(entityAccount.address)).to.equal(await contractInstance.getProcessId(entityAccount.address, 1, namespaceId, DEFAULT_CHAIN_ID))

            // randomAccount has no process yet
            namespaceId = await contractInstance.namespaceId()
            expect((await contractInstance.getEntityProcessCount(randomAccount1.address)).toNumber()).to.eq(0)
            expect(await contractInstance.getNextProcessId(randomAccount.address)).to.equal(await contractInstance.getProcessId(randomAccount.address, 0, namespaceId, DEFAULT_CHAIN_ID))
        })

        it("Should work for any creator account", async () => {
            processId = await contractInstance.getNextProcessId(randomAccount.address)
            const builder = new ProcessBuilder(accounts).withChainId(chainId)

            contractInstance = await builder.withEntityAccount(randomAccount).build()
            let contractState = await contractInstance.get(processId)
            let params = ProcessContractParameters.fromContract(contractState)
            expect(params.entityAddress).to.eq(randomAccount.address)

            processId = await contractInstance.getNextProcessId(randomAccount2.address)
            contractInstance = await builder.withEntityAccount(randomAccount2).build()
            contractState = await contractInstance.get(processId)
            params = ProcessContractParameters.fromContract(contractState)
            expect(params.entityAddress).to.eq(randomAccount2.address)
        }).timeout(5000)
    })

    describe("Results publishing", () => {
        it("Should allow to publish the results", async () => {
            const genesisInstance = (await new GenesisBuilder(accounts).withOracles([randomAccount1.address]).build())
            const resultsInstance = await new ResultsBuilder(accounts).withGenesisAddress(genesisInstance.address).build()

            // created by the entity
            contractInstance = await new ProcessBuilder(accounts)
                .withChainId(chainId)
                .withEntityAccount(entityAccount)
                .withResultsAddress(resultsInstance.address)
                .withQuestionCount(2)
                .build()

            await resultsInstance.connect(baseAccount.wallet).setProcessesAddress(contractInstance.address)

            expect(resultsInstance.getResults(processId)).to.throw

            const tx1 = await resultsInstance.connect(randomAccount1.wallet).setResults(processId, [[1, 5, 4], [4, 1, 5]], 10, DEFAULT_CHAIN_ID)
            expect(tx1).to.be.ok
            expect(tx1.to).to.equal(resultsInstance.address)
            await tx1.wait()

            const result2 = await resultsInstance.getResults(processId)
            expect(result2.tally).to.deep.equal([[1, 5, 4], [4, 1, 5]])
            expect(result2.height).to.eq(10)
        })

        it("should change the state to RESULTS")
    })

    describe("Process metadata", () => {
        it("Should register a new process on the blockchain")

        // TODO: ENS contracts need to be mocked

        // it("Should register a new process on the blockchain", async () => {
        //     const dvoteGw = new DVoteGateway({ uri: "http://localhost:9001/dvote", supportedApis: ["file", "vote", "census"] })
        //     const w3Gw = new Web3Gateway(server.web3.provider)
        //     let gw = new Gateway(dvoteGw, w3Gw)
        //     await gw.init()

        //     const oldResolveName = gw.provider.resolveName
        //     gw["web3"]["_provider"].resolveName = mockResolveName

        //     const metadata: ProcessMetadata = {
        //         version: "1.1",
        //         title: { default: "test" },
        //         description: { default: "test" },
        //         media: {
        //             header: "header"
        //         },
        //         questions: [{
        //             title: { default: "title" },
        //             description: { default: "description" },
        //             choices: [
        //                 { title: { default: "Yes" }, value: 0 },
        //                 { title: { default: "No" }, value: 1 },
        //             ]
        //         }]
        //     }
        //     const params = {
        //         mode: ProcessMode.AUTO_START,
        //         envelopeType: ProcessEnvelopeType.make(),
        //         censusOrigin: ProcessCensusOrigin.OFF_CHAIN_TREE,
        //         metadata,
        //         censusRoot: "0x1",
        //         censusUri: "ipfs://1234",
        //         startBlock: 200,
        //         blockCount: 1000,
        //         maxCount: 1,
        //         maxValue: 5,
        //         maxTotalCost: 10,
        //         maxVoteOverwrites: 0,
        //         costExponent: 10000,
        //         namespace: DEFAULT_NAMESPACE,
        //         paramsSignature: DEFAULT_PARAMS_SIGNATURE
        //     }

        //     server.dvote.addResponse({ ok: true, content: Buffer.from(JSON.stringify(EntityMetadataTemplate)).toString("base64") }) // internal getMetadata > fetchFile
        //     server.dvote.addResponse({ ok: true, content: "" }) // fetchFile
        //     const processId = await VotingApi.newProcess(params, entityAccount, gw)

        //     gw.disconnect()

        //     gw["web3"]["_provider"].resolveName = oldResolveName
        // })

        it("Should fetch the metadata of a process")
        it("Should fail creating a process if the Entity does not exist")
        it("Should return the processId after creating it")
    })

    describe("Remote", () => {
        it("Should fetch the census Merkle Proof from the census service")
        it("Should submit a Vote Envelope to a Gateway")
        it("Should request the status of a vote to a Gateway and provide a response")
    })
})
