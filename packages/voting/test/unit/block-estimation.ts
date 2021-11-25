import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { VOCHAIN_BLOCK_TIME } from "@vocdoni/common"
import { VotingApi } from "../../src"

addCompletionHooks()

describe("Vochain Block Status", () => {
    const baseBlock = 1000
    const pad = 1000  // Min resolution of the GW timestamp block

    describe("Should estimate blocks for a given date when average times are stable", () => {
        const stdBlockTime = 10000
        const slowBlockTime = 12000
        const slowerBlockTime = 20000
        const shortBlockTime = 8000

        it("Should return 0 if the date is before the first block", async () => {
            let now: number

            now = Date.now()
            let status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 9 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(0), status)).to.eq(0)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 9 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - 1000 * 60 * 60 * 3), status)).to.eq(0)
        })

        it("On standard block times", async () => {
            let now: number

            // Block #1000 mined 0 seconds ago. Standard block times.
            now = Date.now()
            let status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock, "The current block should be " + baseBlock)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - stdBlockTime / 4), status)).to.eq(baseBlock - 1)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - stdBlockTime), status)).to.eq(baseBlock - 1)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - stdBlockTime - pad), status)).to.eq(baseBlock - 2)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - stdBlockTime * 5), status)).to.eq(baseBlock - 5)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - stdBlockTime * 15), status)).to.eq(baseBlock - 15)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + stdBlockTime / 10), status)).to.eq(baseBlock)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + stdBlockTime), status)).to.eq(baseBlock + 1)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + stdBlockTime + pad), status)).to.eq(baseBlock + 1)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + stdBlockTime * 5), status)).to.eq(baseBlock + 5)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + stdBlockTime * 15), status)).to.eq(baseBlock + 15)

            // Block #1000 mined 5 seconds ago. Standard block times.
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 5 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now), status)).to.eq(baseBlock)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 5 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - stdBlockTime * 0.4), status)).to.eq(baseBlock)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 5 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - stdBlockTime * 0.5 - pad), status)).to.eq(baseBlock - 1)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 5 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + stdBlockTime * 0.4), status)).to.eq(baseBlock)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 5 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + stdBlockTime * 0.5 + pad), status)).to.eq(baseBlock + 1)

            // Block #1000 mined 9 seconds ago. Standard block times.
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 9 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now), status)).to.eq(baseBlock)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 9 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - stdBlockTime * 0.9), status)).to.eq(baseBlock)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 9 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - stdBlockTime * 0.9 - pad), status)).to.eq(baseBlock - 1)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 9 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + stdBlockTime + pad), status)).to.eq(baseBlock + 2)

            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now - 9 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + stdBlockTime * 0.1 + pad), status)).to.eq(baseBlock + 1)
        })

        it("On slow block times", async () => {
            let now: number

            // Block #1000 mined 0 seconds ago. Slower block times.
            now = Date.now()
            let status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowBlockTime - pad), status)).to.eq(baseBlock - 2)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowBlockTime * 2 - pad), status)).to.eq(baseBlock - 3)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowBlockTime * 50 - pad), status)).to.eq(baseBlock - 51)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowBlockTime + pad), status)).to.eq(baseBlock + 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowBlockTime * 2 + pad), status)).to.eq(baseBlock + 2)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowBlockTime * 50 + pad), status)).to.eq(baseBlock + 50)

            // Block #1000 mined 8 seconds ago. Slower block times.
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 8 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 8 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowBlockTime * 8 / 12), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 8 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowBlockTime * 8 / 12 - pad), status)).to.eq(baseBlock - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 8 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowBlockTime * 50 - pad), status)).to.eq(baseBlock - 50)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 8 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowBlockTime * 2 / 12), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 8 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowBlockTime * 4 / 12), status)).to.eq(baseBlock + 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 8 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowBlockTime * 50 + pad), status)).to.eq(baseBlock + 50)

            // Block #1000 mined 11 seconds ago. Slower block times.
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowBlockTime * 11 / 12), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowBlockTime * 11 / 12 - pad), status)).to.eq(baseBlock - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowBlockTime * 50 - pad), status)).to.eq(baseBlock - 50)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowBlockTime / 12), status)).to.eq(baseBlock + 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowBlockTime * 50), status)).to.eq(baseBlock + 50)
        })

        it("On very slow block times", async () => {
            let now: number

            // Block #1000 mined 15 seconds ago. Very slow block
            now = Date.now()
            let status = { blockTimes: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: now - 15 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: now - 15 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowerBlockTime * 15 / 20), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: now - 15 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowerBlockTime * 15 / 20 - pad), status)).to.eq(baseBlock - 1)
            now = Date.now()
            status = { blockTimes: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: now - 15 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - slowerBlockTime * 50 - pad), status)).to.eq(baseBlock - 50)
            now = Date.now()
            status = { blockTimes: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: now - 15 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowerBlockTime * 2 / 20), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: now - 15 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowerBlockTime * 5 / 20), status)).to.eq(baseBlock + 1)
            now = Date.now()
            status = { blockTimes: [slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime, slowerBlockTime], blockTimestamp: now - 15 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + slowerBlockTime * 50 + pad), status)).to.eq(baseBlock + 50)
        })

        it("On shorter block times", async () => {
            let now: number

            // Block #1000 mined 0 seconds ago. Shorter block times.
            now = Date.now()
            let status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - shortBlockTime - pad), status)).to.eq(baseBlock - 2)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - shortBlockTime * 2 - pad), status)).to.eq(baseBlock - 3)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - shortBlockTime * 50 - pad), status)).to.eq(baseBlock - 51)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + shortBlockTime + pad), status)).to.eq(baseBlock + 1)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + shortBlockTime * 2 + pad), status)).to.eq(baseBlock + 2)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 0 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + shortBlockTime * 50 + pad), status)).to.eq(baseBlock + 50)
            // Block #1000 mined 3 seconds ago. Shorter block times.
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 3 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 3 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - shortBlockTime * 3 / 8), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 3 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - shortBlockTime * 3 / 8 - pad), status)).to.eq(baseBlock - 1)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 3 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - shortBlockTime * 50 - pad), status)).to.eq(baseBlock - 50)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 3 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + shortBlockTime * 2 / 8), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 3 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + shortBlockTime * 5 / 8), status)).to.eq(baseBlock + 1)
            now = Date.now()
            status = { blockTimes: [shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime, shortBlockTime], blockTimestamp: now - 3 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + shortBlockTime * 50 + pad), status)).to.eq(baseBlock + 50)
        })
    })

    describe("Should estimate blocks for a given date when average times are not stable", () => {
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

            let expectedBlock: number
            let dateOffset: number
            let avgBlockTime: number

            // Block #20000 mined 0 seconds ago. All standard.
            now = Date.now()
            let status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerDay * 2
            avgBlockTime = stdBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)

            // Daily is slow
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerDay * 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPerDay + blocksPer6h) / 2
            avgBlockTime = ((slowBlockTime + stdBlockTime) / 2)
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)

            // 6h is also slow
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPer6h
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPer6h + blocksPerH) / 2
            avgBlockTime = ((slowBlockTime + stdBlockTime) / 2)
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)

            // h is also slow
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerH
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPerH + blocksPer10m) / 2
            avgBlockTime = (slowBlockTime + stdBlockTime) / 2
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
            // 10m is also slow
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPer10m
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPer10m + blocksPerM) / 2
            avgBlockTime = ((slowBlockTime + stdBlockTime) / 2)
            expectedBlock = Math.floor(baseBlock - dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)

            // everything is slow
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerM * 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
        })

        it("When some averages are unset", async () => {
            let now: number
            const baseBlock = 20000 // 20x to allow for two days
            const zero = 0

            let expectedBlock: number
            let dateOffset: number
            let avgBlockTime: number

            // Block #1000 mined 0 seconds ago. All set.
            now = Date.now()
            let status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerDay * 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)

            // Daily is unset
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerDay * 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
            dateOffset = 10000 * (blocksPerDay + blocksPer6h) / 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)

            // 6h is also unset
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPer6h
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPer6h + blocksPerH) / 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)

            // h is also unset
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerH
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPerH + blocksPer10m) / 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, slowBlockTime, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)

            // 10m is also unset
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPer10m
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * (blocksPer10m + blocksPerM) / 2
            avgBlockTime = slowBlockTime
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.floor(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [slowBlockTime, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)

            // everything is unset
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            dateOffset = VOCHAIN_BLOCK_TIME * 1000 * blocksPerM * 2
            avgBlockTime = VOCHAIN_BLOCK_TIME * 1000
            expectedBlock = Math.round(baseBlock - dateOffset / avgBlockTime - 1)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - dateOffset - pad), status)).to.eq(expectedBlock)
            expectedBlock = Math.round(baseBlock + dateOffset / avgBlockTime)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + dateOffset), status)).to.eq(expectedBlock)
        })

        it("When average times are not available at all", async () => {
            let now: number
            const zero = 0

            // Block #1000 mined 0 seconds ago. Standard block times.
            now = Date.now()
            let status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - VOCHAIN_BLOCK_TIME * 1000 / 10), status)).to.eq(baseBlock - 1)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - VOCHAIN_BLOCK_TIME * 1000), status)).to.eq(baseBlock - 1)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - VOCHAIN_BLOCK_TIME * 1000 - pad), status)).to.eq(baseBlock - 2)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 5), status)).to.eq(baseBlock - 5)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 15), status)).to.eq(baseBlock - 15)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + VOCHAIN_BLOCK_TIME * 1000 / 10), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + VOCHAIN_BLOCK_TIME * 1000), status)).to.eq(baseBlock + 1)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + VOCHAIN_BLOCK_TIME * 1000 + 50), status)).to.eq(baseBlock + 1)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + VOCHAIN_BLOCK_TIME * 1000 * 5), status)).to.eq(baseBlock + 5)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + VOCHAIN_BLOCK_TIME * 1000 * 15), status)).to.eq(baseBlock + 15)

            // Block #1000 mined 6 seconds ago. Standard block times.
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now - 6 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now - 6 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 0.4), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now - 6 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 0.5 - pad), status)).to.eq(baseBlock - 1)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now - 6 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + VOCHAIN_BLOCK_TIME * 1000 * 0.4), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now - 6 * 1000, blockNumber: baseBlock }

            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + VOCHAIN_BLOCK_TIME * 1000 * 0.5 + 50), status)).to.eq(baseBlock + 1)

            // Block #1000 mined 11 seconds ago. Standard block times.
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 0.9), status)).to.eq(baseBlock)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now - VOCHAIN_BLOCK_TIME * 1000 * 0.9 - pad - pad), status)).to.eq(baseBlock - 1)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }
            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + VOCHAIN_BLOCK_TIME * 1000 + pad), status)).to.eq(baseBlock + 2)
            now = Date.now()
            status = { blockTimes: [zero, zero, zero, zero, zero], blockTimestamp: now - 11 * 1000, blockNumber: baseBlock }

            expect(VotingApi.estimateBlockAtDateTimeSync(new Date(now + VOCHAIN_BLOCK_TIME * 1000 * 0.1 + pad), status)).to.eq(baseBlock + 1)
        })
    })
})
