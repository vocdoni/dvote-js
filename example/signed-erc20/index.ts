import * as assert from "assert"
import { readFileSync, writeFileSync } from "fs"
import { ProcessMetadata } from "@vocdoni/data-models"
import { ProcessState, VotingApi } from "@vocdoni/voting"
import { Wallet } from "@ethersproject/wallet"
import { getConfig } from "./config"
import { connectGateways } from "./net"
import { getAccounts, TestAccount } from "./census"
import { waitUntilPresent, waitUntilStarted } from "./util"
import { checkVoteResults, launchNewVote, submitVotes } from "./voting"

const config = getConfig()

async function main() {
    let processId: string
    let processState: ProcessState
    let processMetadata: ProcessMetadata
    let accounts: TestAccount[]

    // Connect to a GW
    const gwPool = await connectGateways()
    accounts = getAccounts()
    const entityWallet = new Wallet(accounts[0].privateKey).connect(gwPool.provider)
    console.log("Entity ID", entityWallet.address)

    if (config.readExistingProcess) {
        console.log("Reading process metadata")
        const procInfo: { processId: string, processMetadata: ProcessMetadata } = JSON.parse(readFileSync(config.processInfoFilePath).toString())
        processId = procInfo.processId
        processMetadata = procInfo.processMetadata

        await waitUntilPresent(processId, gwPool)

        processState = await VotingApi.getProcessState(processId, gwPool)

        assert(processId)
        assert(processMetadata)
    }
    else {
        // Create a new voting process
        const result = await launchNewVote(entityWallet, gwPool)
        processId = result.processId
        processMetadata = result.processMetadata
        processState = result.processState

        assert(processId)
        assert(processState)
        assert(processMetadata)
        writeFileSync(config.processInfoFilePath, JSON.stringify({ processId, processMetadata }, null, 2))
    }

    console.log("- Entity Addr", processState.entityId)
    console.log("- Process ID", processId)
    console.log("- Process start block", processState.startBlock)
    console.log("- Process end block", processState.endBlock)
    console.log("- Process merkle root", processState.censusRoot)
    console.log("- Process merkle tree", processState.censusURI)
    console.log("-", accounts.length, "accounts on the census")

    await waitUntilStarted(processId, processState.startBlock, gwPool)

    await submitVotes(processId, processState, processMetadata, accounts, gwPool)

    await checkVoteResults(processId, gwPool)
}

/////////////////////////////////////////////////////////////////////////////
// MAIN
/////////////////////////////////////////////////////////////////////////////

main()
    .then(() => {
        console.log("Done")
        process.exit(0)
    })
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
