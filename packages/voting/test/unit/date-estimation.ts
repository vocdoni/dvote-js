import "mocha" // using @types/mocha
import { expect } from "chai"
import { addCompletionHooks } from "../mocha-hooks"

import { VOCHAIN_BLOCK_TIME } from "@vocdoni/common"
import { VotingApi } from "../../src"

addCompletionHooks()

describe("Vochain Block Status", () => {
  const baseBlock = 1000

  describe("Should estimate the date for a given block ", () => {
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

      // Std block time
      for (let diff = -50; diff <= 50; diff += 3) {
        now = Date.now()
        let status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: round1000(now), blockNumber: baseBlock }
        expect((VotingApi.estimateDateAtBlockSync(baseBlock + diff, status)).getTime()).to.eq(round1000(now) + diff * stdBlockTime)
      }

      // Double block time
      for (let diff = -50; diff <= 50; diff += 3) {
        now = Date.now()
        let status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: round1000(now), blockNumber: baseBlock }
        expect((VotingApi.estimateDateAtBlockSync(baseBlock + diff, status)).getTime()).to.eq(round1000(now) + diff * slowBlockTime)
      }
    })

    it("When average times are unstable", async () => {
      let now: number, blockDiff: number

      // Std block time
      now = Date.now()
      blockDiff = (blocksPerDay + blocksPer6h) / 2
      let status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime], blockTimestamp: round1000(now), blockNumber: baseBlock }
      expect((VotingApi.estimateDateAtBlockSync(baseBlock + blockDiff, status)).getTime()).to.eq(round1000(now) + blockDiff * ((stdBlockTime + slowBlockTime) / 2))

      now = Date.now()
      blockDiff = (blocksPer6h + blocksPerH) / 2
      status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: round1000(now), blockNumber: baseBlock }
      expect((VotingApi.estimateDateAtBlockSync(baseBlock + blockDiff, status)).getTime()).to.eq(round1000(now) + blockDiff * ((stdBlockTime + slowBlockTime) / 2))

      now = Date.now()
      blockDiff = (blocksPerH + blocksPer10m) / 2
      status = { blockTimes: [stdBlockTime, stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: round1000(now), blockNumber: baseBlock }
      expect((VotingApi.estimateDateAtBlockSync(baseBlock + blockDiff, status)).getTime()).to.eq(round1000(now) + blockDiff * ((stdBlockTime + slowBlockTime) / 2))

      now = Date.now()
      blockDiff = (blocksPer10m + blocksPerM) / 2
      status = { blockTimes: [stdBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: round1000(now), blockNumber: baseBlock }
      expect((VotingApi.estimateDateAtBlockSync(baseBlock + blockDiff, status)).getTime()).to.eq(round1000(now) + blockDiff * ((stdBlockTime + slowBlockTime) / 2))
    })

    it("When average times are not available", async () => {
      let now: number

      // Std block time
      for (let diff = -50; diff <= 50; diff += 3) {
        now = Date.now()
        let status = { blockTimes: [stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime, stdBlockTime], blockTimestamp: round1000(now), blockNumber: baseBlock }
        expect((VotingApi.estimateDateAtBlockSync(baseBlock + diff, status)).getTime()).to.eq(round1000(now) + diff * stdBlockTime)
      }

      // Double block time
      for (let diff = -50; diff <= 50; diff += 3) {
        now = Date.now()
        let status = { blockTimes: [slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime, slowBlockTime], blockTimestamp: round1000(now), blockNumber: baseBlock }
        expect((VotingApi.estimateDateAtBlockSync(baseBlock + diff, status)).getTime()).to.eq(round1000(now) + diff * slowBlockTime)
      }
    })
  })
})

function round1000(v: number) {
  return Math.floor(v / 1000) * 1000
}
