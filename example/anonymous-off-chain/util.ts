import { IGatewayClient } from "@vocdoni/client"
import { VochainWaiter, VotingApi } from "@vocdoni/voting"
import * as assert from "assert"
import { ProcessStatus } from "dvote-solidity"
import { getConfig } from "./config"

const config = getConfig()

export async function waitUntilPresent(processId: string, gwPool: IGatewayClient) {
    assert(gwPool)
    assert(processId)

    let attempts = 6
    while (attempts >= 0) {
        console.log("Waiting for process", processId, "to be created")
        await VochainWaiter.wait(1, gwPool)

        const state = await VotingApi.getProcessState(processId, gwPool).catch(() => null)
        if (state?.entityId) break

        attempts--
    }
    if (attempts < 0) throw new Error("The process still does not exist on the Vochain")
}

export async function waitUntilStarted(processId: string, startBlock: number, gwPool: IGatewayClient) {
    assert(gwPool)
    assert(processId)

    // start block
    await VochainWaiter.waitUntil(startBlock, gwPool, { verbose: true })

    console.log("Waiting for the process to be ready")
    const state = await VotingApi.getProcessState(processId, gwPool)

    // assert.strictEqual(state.status, ProcessStatus.READY, "Should be ready but is not")
}

export function getChoicesForVoter(questionCount: number, voterIdx: number) {
    const indexes = new Array(questionCount).fill(0).map((_, i) => i)

    return indexes.map((_, idx) => {
        switch (config.votesPattern) {
            case "all-0": return 0
            case "all-1": return 1
            case "all-2": return 2
            case "all-even": return (voterIdx % 2 == 0) ? 0 : 1
            case "incremental": return idx
            default: return 0
        }
    })
}
