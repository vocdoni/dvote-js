import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"
import { DVoteGateway, IDVoteGateway, Gateway, IGateway, Web3Gateway } from "../../src/net/gateway"
import { getBlockHeight, getBlockStatus, estimateBlockAtDateTime, estimateDateAtBlock } from "../../src/api/voting"
import { DevWebSocketServer, WebSocketMockedInteraction, WSResponse } from "../helpers/web-socket-service"
import { Buffer } from "buffer"
import GatewayInfo from "../../src/wrappers/gateway-info"
import { VOCHAIN_BLOCK_TIME } from "../../src/constants"
const ganacheRpcServer = require("ganache-core").server

const dvotePort = 8500
const w3Port = 8600
const gatewayInfo = new GatewayInfo(`ws://localhost:${dvotePort}`, ["vote"], `http://localhost:${w3Port}/web3`, "")

const defaultConnectResponse = { timestamp: 123, ok: true, apiList: ["file", "vote", "census", "results"], health: 100 }

addCompletionHooks()

describe("DVote Block Status", () => {
    var rpcServer
    const baseBlock = 1000
    const pad = 1000  // Min resolution of the GW timestamp block

    beforeEach(async () => {
        if (rpcServer && rpcServer.close) rpcServer.close()
        rpcServer = ganacheRpcServer()
        await new Promise(resolve => rpcServer.listen(w3Port, (err, info) => resolve(info)))
    })
    afterEach(() => {
        if (rpcServer) {
            rpcServer.close()
            rpcServer = null
        }
    })

    it("Should return the current block number and the timestamp", async () => {
        const gatewayServer = new DevWebSocketServer({
            port: dvotePort,
            responses: [
                defaultConnectResponse,
                { blockTime: [0, 0, 0, 0, 0], blockTimestamp: 1556110602, height: 1234, ok: true, timestamp: 1556110672 },
                { blockTime: [0, 0, 0, 0, 0], blockTimestamp: 1556110612, height: 2345, ok: true, timestamp: 1556110672 },
                { blockTime: [0, 0, 0, 0, 0], blockTimestamp: 1556110622, height: 3456, ok: true, timestamp: 1556110672 },
                { blockTime: [10000, 10000, 10000, 10000, 10000], blockTimestamp: 1556110632, height: 4567, ok: true, timestamp: 1556110672 },
                { blockTime: [10000, 10000, 10000, 10000, 10000], blockTimestamp: 1556110642, height: 10000000, ok: true, timestamp: 1556110672 },
            ]
        })

        const w3 = new Web3Gateway(gatewayInfo)
        w3.isUp = () => Promise.resolve()
        const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
        await gw.connect()

        expect(await getBlockHeight(gw)).to.eq(1234)
        expect(await getBlockHeight(gw)).to.eq(2345)
        expect(await getBlockHeight(gw)).to.eq(3456)
        expect(await getBlockHeight(gw)).to.eq(4567)
        expect(await getBlockHeight(gw)).to.eq(10000000)

        gw.disconnect()
        await gatewayServer.stop()
    })

    it("Should return the current block height, timestamp and average times", async () => {
        const now = new Date()
        const blockTimestampA = Math.floor(now.getTime() / 1000)
        const baseBlock = 1000

        const gatewayServer = new DevWebSocketServer({
            port: dvotePort,
            responses: [
                defaultConnectResponse,
                { blockTime: [10000, 10000, 10000, 10000, 10000], blockTimestamp: blockTimestampA, height: baseBlock, ok: true, timestamp: 1556110672 },
                { blockTime: [10000, 10000, 10000, 10000, 10000], blockTimestamp: blockTimestampA - 5, height: baseBlock, ok: true, timestamp: 1556110672 },
                { blockTime: [10000, 10000, 10000, 10000, 10000], blockTimestamp: blockTimestampA - 9, height: baseBlock, ok: true, timestamp: 1556110672 },
                { blockTime: [12000, 12000, 12000, 12000, 12000], blockTimestamp: blockTimestampA - 8, height: baseBlock, ok: true, timestamp: 1556110672 },
                { blockTime: [12000, 12000, 12000, 12000, 12000], blockTimestamp: blockTimestampA - 11, height: baseBlock, ok: true, timestamp: 1556110672 },
                { blockTime: [20000, 20000, 20000, 20000, 20000], blockTimestamp: blockTimestampA - 15, height: baseBlock, ok: true, timestamp: 1556110672 },
                { blockTime: [8000, 8000, 8000, 8000, 8000], blockTimestamp: blockTimestampA - 0, height: baseBlock, ok: true, timestamp: 1556110672 },
                { blockTime: [8000, 8000, 8000, 8000, 8000], blockTimestamp: blockTimestampA - 3, height: baseBlock, ok: true, timestamp: 1556110672 },
            ]
        })

        const w3 = new Web3Gateway(gatewayInfo)
        w3.isUp = () => Promise.resolve()
        const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
        await gw.connect()

        expect(await getBlockStatus(gw)).to.deep.eq({ blockTimes: [10000, 10000, 10000, 10000, 10000], blockTimestamp: blockTimestampA * 1000, blockNumber: baseBlock })
        expect(await getBlockStatus(gw)).to.deep.eq({ blockTimes: [10000, 10000, 10000, 10000, 10000], blockTimestamp: (blockTimestampA - 5) * 1000, blockNumber: baseBlock })
        expect(await getBlockStatus(gw)).to.deep.eq({ blockTimes: [10000, 10000, 10000, 10000, 10000], blockTimestamp: (blockTimestampA - 9) * 1000, blockNumber: baseBlock })
        expect(await getBlockStatus(gw)).to.deep.eq({ blockTimes: [12000, 12000, 12000, 12000, 12000], blockTimestamp: (blockTimestampA - 8) * 1000, blockNumber: baseBlock })
        expect(await getBlockStatus(gw)).to.deep.eq({ blockTimes: [12000, 12000, 12000, 12000, 12000], blockTimestamp: (blockTimestampA - 11) * 1000, blockNumber: baseBlock })
        expect(await getBlockStatus(gw)).to.deep.eq({ blockTimes: [20000, 20000, 20000, 20000, 20000], blockTimestamp: (blockTimestampA - 15) * 1000, blockNumber: baseBlock })
        expect(await getBlockStatus(gw)).to.deep.eq({ blockTimes: [8000, 8000, 8000, 8000, 8000], blockTimestamp: (blockTimestampA - 0) * 1000, blockNumber: baseBlock })
        expect(await getBlockStatus(gw)).to.deep.eq({ blockTimes: [8000, 8000, 8000, 8000, 8000], blockTimestamp: (blockTimestampA - 3) * 1000, blockNumber: baseBlock })

        gw.disconnect()
        await gatewayServer.stop()
    })

    describe("Should estimate blocks for a given date when average times are stable", () => {
        beforeEach(async () => {
            if (rpcServer && rpcServer.close) rpcServer.close()
            rpcServer = ganacheRpcServer()
            await new Promise(resolve => rpcServer.listen(w3Port, (err, info) => resolve(info)))
        })
        afterEach(() => {
            if (rpcServer) {
                rpcServer.close()
                rpcServer = null
            }
        })

        const stdBlockTime = 10000
        const slowBlockTime = 12000
        const slowerBlockTime = 20000
        const shortBlockTime = 8000

        it("Should return 0 if the date is before the first block", async () => {
            let now: number
            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 9, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(0), gw)).to.eq(0)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 9, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - 1000 * 60 * 60 * 3), gw)).to.eq(0)

            gw.disconnect()
            await gatewayServer.stop()
        })

        it("On standard block times", async () => {
            let now: number
            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()


            // Block #1000 mined 0 seconds ago. Standard block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock, "The current block should be " + baseBlock)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - stdBlockTime / 4), gw)).to.eq(baseBlock - 1)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - stdBlockTime), gw)).to.eq(baseBlock - 1)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - stdBlockTime - pad), gw)).to.eq(baseBlock - 2)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - stdBlockTime * 5), gw)).to.eq(baseBlock - 5)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - stdBlockTime * 15), gw)).to.eq(baseBlock - 15)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + stdBlockTime / 10), gw)).to.eq(baseBlock)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + stdBlockTime), gw)).to.eq(baseBlock + 1)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + stdBlockTime + pad), gw)).to.eq(baseBlock + 1)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + stdBlockTime * 5), gw)).to.eq(baseBlock + 5)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + stdBlockTime * 15), gw)).to.eq(baseBlock + 15)

            // Block #1000 mined 5 seconds ago. Standard block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 5, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now), gw)).to.eq(baseBlock)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 5, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - stdBlockTime * 0.4), gw)).to.eq(baseBlock)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 5, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - stdBlockTime * 0.5 - pad), gw)).to.eq(baseBlock - 1)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 5, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + stdBlockTime * 0.4), gw)).to.eq(baseBlock)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 5, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + stdBlockTime * 0.5 + pad), gw)).to.eq(baseBlock + 1)

            // Block #1000 mined 9 seconds ago. Standard block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 9, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now), gw)).to.eq(baseBlock)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 9, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - stdBlockTime * 0.9), gw)).to.eq(baseBlock)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 9, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - stdBlockTime * 0.9 - pad), gw)).to.eq(baseBlock - 1)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 9, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + stdBlockTime + pad), gw)).to.eq(baseBlock + 2)

            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000) - 9, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + stdBlockTime * 0.1 + pad), gw)).to.eq(baseBlock + 1)


            gw.disconnect()
            await gatewayServer.stop()
        })

        it("On slow block times", async () => {
            let now: number
            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()

            // Block #1000 mined 0 seconds ago. Slower block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now - slowBlockTime - pad), gw)).to.eq(baseBlock - 2)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now - slowBlockTime * 2 - pad), gw)).to.eq(baseBlock - 3)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now - slowBlockTime * 50 - pad), gw)).to.eq(baseBlock - 51)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now + slowBlockTime + pad), gw)).to.eq(baseBlock + 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now + slowBlockTime * 2 + pad), gw)).to.eq(baseBlock + 2)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now + slowBlockTime * 50 + pad), gw)).to.eq(baseBlock + 50)

            // Block #1000 mined 8 seconds ago. Slower block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 8, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 8, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now - slowBlockTime * 8 / 12), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 8, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now - slowBlockTime * 8 / 12 - pad), gw)).to.eq(baseBlock - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 8, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now - slowBlockTime * 50 - pad), gw)).to.eq(baseBlock - 50)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 8, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now + slowBlockTime * 2 / 12), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 8, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now + slowBlockTime * 4 / 12), gw)).to.eq(baseBlock + 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 8, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now + slowBlockTime * 50 + pad), gw)).to.eq(baseBlock + 50)

            // Block #1000 mined 11 seconds ago. Slower block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now - slowBlockTime * 11 / 12), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now - slowBlockTime * 11 / 12 - pad), gw)).to.eq(baseBlock - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now - slowBlockTime * 50 - pad), gw)).to.eq(baseBlock - 50)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now + slowBlockTime / 12), gw)).to.eq(baseBlock + 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, timestamp: 1556110672 },)
            expect(await estimateBlockAtDateTime(new Date(now + slowBlockTime * 50), gw)).to.eq(baseBlock + 50)

            gw.disconnect()
            await gatewayServer.stop()
        })

        it("On very slow block times", async () => {
            let now: number

            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()

            // Block #1000 mined 15 seconds ago. Very slow block
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: Math.floor(now / 1000) - 15, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: Math.floor(now / 1000) - 15, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - slowerBlockTime * 15 / 20), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: Math.floor(now / 1000) - 15, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - slowerBlockTime * 15 / 20 - pad), gw)).to.eq(baseBlock - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: Math.floor(now / 1000) - 15, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - slowerBlockTime * 50 - pad), gw)).to.eq(baseBlock - 50)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: Math.floor(now / 1000) - 15, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + slowerBlockTime * 2 / 20), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: Math.floor(now / 1000) - 15, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + slowerBlockTime * 5 / 20), gw)).to.eq(baseBlock + 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: Math.floor(now / 1000) - 15, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + slowerBlockTime * 50 + pad), gw)).to.eq(baseBlock + 50)

            gw.disconnect()
            await gatewayServer.stop()
        })

        it("On shorter block times", async () => {
            let now: number

            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()


            // Block #1000 mined 0 seconds ago. Shorter block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - shortBlockTime - pad), gw)).to.eq(baseBlock - 2)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - shortBlockTime * 2 - pad), gw)).to.eq(baseBlock - 3)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - shortBlockTime * 50 - pad), gw)).to.eq(baseBlock - 51)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + shortBlockTime + pad), gw)).to.eq(baseBlock + 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + shortBlockTime * 2 + pad), gw)).to.eq(baseBlock + 2)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 0, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + shortBlockTime * 50 + pad), gw)).to.eq(baseBlock + 50)
            // Block #1000 mined 3 seconds ago. Shorter block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 3, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 3, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - shortBlockTime * 3 / 8), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 3, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - shortBlockTime * 3 / 8 - pad), gw)).to.eq(baseBlock - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 3, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - shortBlockTime * 50 - pad), gw)).to.eq(baseBlock - 50)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 3, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + shortBlockTime * 2 / 8), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 3, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + shortBlockTime * 5 / 8), gw)).to.eq(baseBlock + 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: Math.floor(now / 1000) - 3, height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + shortBlockTime * 50 + pad), gw)).to.eq(baseBlock + 50)

            gw.disconnect()
            await gatewayServer.stop()
        })
    })

    describe("Should estimate blocks for a given date when average times are not stable", () => {
        beforeEach(async () => {
            if (rpcServer && rpcServer.close) rpcServer.close()
            rpcServer = ganacheRpcServer()
            await new Promise(resolve => rpcServer.listen(w3Port, (err, info) => resolve(info)))
        })
        afterEach(() => {
            if (rpcServer) {
                rpcServer.close()
                rpcServer = null
            }
        })

        const stdBlockTime = VOCHAIN_BLOCK_TIME * 1000
        const slowBlockTime = 20000

        // 1m, 10m, 1h, 6h and 24h
        const blocksPerM = 60 / VOCHAIN_BLOCK_TIME
        const blocksPer10m = 10 * blocksPerM
        const blocksPerH = blocksPerM * 60
        const blocksPer6h = 6 * blocksPerH
        const blocksPerDay = 24 * blocksPerH

        it("When all averages are set", async () => {
            const baseBlock = 20000 // 20x to allow for two days
            let now: number

            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()

            let expectedBlock: number
            let dateOffset: number
            let avgBlockTime: number

            // Block #20000 mined 0 seconds ago. All standard.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerDay * 2
            avgBlockTime = stdBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            // Daily is slow
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerDay * 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPerDay + blocksPer6h) / 2
            avgBlockTime = ((slowBlockTime + stdBlockTime) / 2)
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            // 6h is also slow
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPer6h
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPer6h + blocksPerH) / 2
            avgBlockTime = ((slowBlockTime + stdBlockTime) / 2)
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            // h is also slow
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerH
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPerH + blocksPer10m) / 2
            avgBlockTime = (slowBlockTime + stdBlockTime) / 2
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)
            // 10m is also slow
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPer10m
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPer10m + blocksPerM) / 2
            avgBlockTime = ((slowBlockTime + stdBlockTime) / 2)
            expectedBlock = Math.floor(baseBlock - dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            // everything is slow
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerM * 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            gw.disconnect()
            await gatewayServer.stop()
        })

        it("When some averages are unset", async () => {
            let now: number
            const baseBlock = 20000 // 20x to allow for two days
            const zero = 0

            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse,] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()

            let expectedBlock: number
            let dateOffset: number
            let avgBlockTime: number

            // Block #1000 mined 0 seconds ago. All set.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerDay * 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            // Daily is unset
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerDay * 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)
            dateOffset = 10000 * (blocksPerDay + blocksPer6h) / 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            // 6h is also unset
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPer6h
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPer6h + blocksPerH) / 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            // h is also unset
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerH
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPerH + blocksPer10m) / 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            // 10m is also unset
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPer10m
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPer10m + blocksPerM) / 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [slowBlockTime, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            // everything is unset
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerM * 2
            avgBlockTime = VOCHAIN_BLOCK_TIME * 1000
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - dateOffset - pad), gw)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + dateOffset), gw)).to.eq(expectedBlock)

            gw.disconnect()
            await gatewayServer.stop()
        })

        it("When average times are not available at all", async () => {
            let now: number
            const zero = 0

            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()

            // Block #1000 mined 0 seconds ago. Standard block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - VOCHAIN_BLOCK_TIME * 1000 / 10), gw)).to.eq(baseBlock - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - VOCHAIN_BLOCK_TIME * 1000), gw)).to.eq(baseBlock - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - VOCHAIN_BLOCK_TIME * 1000 - pad), gw)).to.eq(baseBlock - 2)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 5), gw)).to.eq(baseBlock - 5)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 15), gw)).to.eq(baseBlock - 15)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + VOCHAIN_BLOCK_TIME * 1000 / 10), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + VOCHAIN_BLOCK_TIME * 1000), gw)).to.eq(baseBlock + 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + VOCHAIN_BLOCK_TIME * 1000 + 50), gw)).to.eq(baseBlock + 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + VOCHAIN_BLOCK_TIME * 1000 * 5), gw)).to.eq(baseBlock + 5)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + VOCHAIN_BLOCK_TIME * 1000 * 15), gw)).to.eq(baseBlock + 15)

            // Block #1000 mined 6 seconds ago. Standard block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000) - 6, height: baseBlock, ok: true, request: "dummy", timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000) - 6, height: baseBlock, ok: true, request: "dummy", timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 0.4), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000) - 6, height: baseBlock, ok: true, request: "dummy", timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 0.5 - pad), gw)).to.eq(baseBlock - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000) - 6, height: baseBlock, ok: true, request: "dummy", timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + VOCHAIN_BLOCK_TIME * 1000 * 0.4), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000) - 6, height: baseBlock, ok: true, request: "dummy", timestamp: 1556110672 })

            expect(await estimateBlockAtDateTime(new Date(now + VOCHAIN_BLOCK_TIME * 1000 * 0.5 + 50), gw)).to.eq(baseBlock + 1)

            // Block #1000 mined 11 seconds ago. Standard block times.
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, request: "dummy", timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, request: "dummy", timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 0.9), gw)).to.eq(baseBlock)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, request: "dummy", timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 0.9 - pad - pad), gw)).to.eq(baseBlock - 1)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, request: "dummy", timestamp: 1556110672 })
            expect(await estimateBlockAtDateTime(new Date(now + VOCHAIN_BLOCK_TIME * 1000 + pad), gw)).to.eq(baseBlock + 2)
            now = Date.now()
            gatewayServer.addResponse({ blockTime: [zero, zero, zero, zero, zero], blockTimestamp: Math.floor(now / 1000) - 11, height: baseBlock, ok: true, request: "dummy", timestamp: 1556110672 })

            expect(await estimateBlockAtDateTime(new Date(now + VOCHAIN_BLOCK_TIME * 1000 * 0.1 + pad), gw)).to.eq(baseBlock + 1)

            gw.disconnect()
            await gatewayServer.stop()
        })
    })

    describe("Should estimate the date for a given block ", () => {
        beforeEach(async () => {
            if (rpcServer && rpcServer.close) rpcServer.close()
            rpcServer = ganacheRpcServer()
            await new Promise(resolve => rpcServer.listen(w3Port, (err, info) => resolve(info)))
        })
        afterEach(() => {
            if (rpcServer) {
                rpcServer.close()
                rpcServer = null
            }
        })

        const stdBlockTime = 10000
        const slowBlockTime = 20000

        // 1m, 10m, 1h, 6h and 24h
        const blocksPerM = 60 / VOCHAIN_BLOCK_TIME
        const blocksPer10m = 10 * blocksPerM
        const blocksPerH = blocksPerM * 60
        const blocksPer6h = 6 * blocksPerH
        const blocksPerDay = 24 * blocksPerH


        it("When average times are stable", async () => {
            let now: number
            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()

            // Std block time
            for (let diff = -50; diff <= 50; diff += 3) {
                now = Date.now()
                gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
                expect((await estimateDateAtBlock(baseBlock + diff, gw)).getTime()).to.eq(round1000(now) + diff * stdBlockTime)
            }

            // Double block time
            for (let diff = -50; diff <= 50; diff += 3) {
                now = Date.now()
                gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
                expect((await estimateDateAtBlock(baseBlock + diff, gw)).getTime()).to.eq(round1000(now) + diff * slowBlockTime)
            }

            gw.disconnect()
            await gatewayServer.stop()
        })

        it("When average times are unstable", async () => {
            let now: number, blockDiff: number
            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()

            // Std block time
            now = Date.now()
            blockDiff = (blocksPerDay + blocksPer6h) / 2
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect((await estimateDateAtBlock(baseBlock + blockDiff, gw)).getTime()).to.eq(round1000(now) + blockDiff * ((stdBlockTime + slowBlockTime) / 2))

            now = Date.now()
            blockDiff = (blocksPer6h + blocksPerH) / 2
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect((await estimateDateAtBlock(baseBlock + blockDiff, gw)).getTime()).to.eq(round1000(now) + blockDiff * ((stdBlockTime + slowBlockTime) / 2))

            now = Date.now()
            blockDiff = (blocksPerH + blocksPer10m) / 2
            gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect((await estimateDateAtBlock(baseBlock + blockDiff, gw)).getTime()).to.eq(round1000(now) + blockDiff * ((stdBlockTime + slowBlockTime) / 2))

            now = Date.now()
            blockDiff = (blocksPer10m + blocksPerM) / 2
            gatewayServer.addResponse({ blockTime: [stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
            expect((await estimateDateAtBlock(baseBlock + blockDiff, gw)).getTime()).to.eq(round1000(now) + blockDiff * ((stdBlockTime + slowBlockTime) / 2))

            gw.disconnect()
            await gatewayServer.stop()
        })

        it("When average times are not available", async () => {
            let now: number
            const zero = 0
            const gatewayServer = new DevWebSocketServer({ port: dvotePort, responses: [defaultConnectResponse] })

            const w3 = new Web3Gateway(gatewayInfo)
            w3.isUp = () => Promise.resolve()
            const gw = new Gateway(new DVoteGateway(gatewayInfo), w3)
            await gw.connect()

            // Std block time
            for (let diff = -50; diff <= 50; diff += 3) {
                now = Date.now()
                gatewayServer.addResponse({ blockTime: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
                expect((await estimateDateAtBlock(baseBlock + diff, gw)).getTime()).to.eq(round1000(now) + diff * stdBlockTime)
            }

            // Double block time
            for (let diff = -50; diff <= 50; diff += 3) {
                now = Date.now()
                gatewayServer.addResponse({ blockTime: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: Math.floor(now / 1000), height: baseBlock, ok: true, timestamp: 1556110672 })
                expect((await estimateDateAtBlock(baseBlock + diff, gw)).getTime()).to.eq(round1000(now) + diff * slowBlockTime)
            }

            gw.disconnect()
            await gatewayServer.stop()
        })
    })
})

function round1000(v: number) {
    return Math.floor(v / 1000) * 1000
}
