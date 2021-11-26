import * as assert from "assert"
import { readFileSync, writeFileSync } from "fs"
import { ProcessMetadata } from "@vocdoni/data-models"
import { VotingApi } from "@vocdoni/voting"
import { Wallet } from "@ethersproject/wallet"
import { ProcessContractParameters } from "@vocdoni/contract-wrappers"
import { getConfig } from "./config"
import { connectGateways } from "./net"
import { ensureEntityMetadata } from "./entity"
import { getAccounts, TestAccount } from "./census"
import { waitUntilPresent, waitUntilStarted } from "./util"
import { checkVoteResults, launchNewVote, submitVotes } from "./voting"

const config = getConfig()

async function main() {
    let processId: string
    let processParams: ProcessContractParameters
    let processMetadata: ProcessMetadata
    let accounts: TestAccount[]

    // Connect to a GW
    const gwPool = await connectGateways()
    accounts = getAccounts()
    const entityWallet = new Wallet(accounts[0].privateKey).connect(gwPool.provider)
    console.log("Entity ID", entityWallet.address)

    await ensureEntityMetadata(entityWallet, gwPool)

    if (config.readExistingProcess) {
        console.log("Reading process metadata")
        const procInfo: { processId: string, processMetadata: ProcessMetadata } = JSON.parse(readFileSync(config.processInfoFilePath).toString())
        processId = procInfo.processId
        processMetadata = procInfo.processMetadata

        processParams = await VotingApi.getProcessContractParameters(processId, gwPool)

        assert(processId)
        assert(processMetadata)
    }
    else {
        // Create a new voting process
        const result = await launchNewVote(entityWallet, gwPool)
        processId = result.processId
        processParams = result.processParams
        processMetadata = result.processMetadata
        assert(processId)
        assert(processParams)
        assert(processMetadata)
        writeFileSync(config.processInfoFilePath, JSON.stringify({ processId, processMetadata }, null, 2))
    }

    await waitUntilPresent(processId, gwPool)

    console.log("- Entity Addr", processParams.entityAddress)
    console.log("- Process ID", processId)
    console.log("- Process start block", processParams.startBlock)
    console.log("- Process end block", processParams.startBlock + processParams.blockCount)
    console.log("- Process merkle root", processParams.censusRoot)
    console.log("- Process merkle tree", processParams.censusUri)
    console.log("-", accounts.length, "accounts on the census")

    await waitUntilStarted(processId, processParams.startBlock, gwPool)

    await submitVotes(processId, processParams, processMetadata, accounts, gwPool)

    await checkVoteResults(processId, processMetadata, gwPool)
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
