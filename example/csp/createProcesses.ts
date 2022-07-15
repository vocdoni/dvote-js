import * as assert from "assert"
import { readFileSync, writeFileSync } from "fs"
import * as fs from 'fs'

import { getConfig } from "./config"
import {  IGatewayClient } from "@vocdoni/client"
import { INewProcessParams, ProcessMetadata, ProcessMetadataTemplate } from "@vocdoni/data-models"
import { Wallet } from "@ethersproject/wallet"
import { ProcessCensusOrigin, ProcessContractParameters, ProcessEnvelopeType, ProcessMode, ProcessStatus } from "@vocdoni/contract-wrappers"
import { connectGateways } from "./net"
import { ensureEntityMetadata } from "./entity"
import { waitUntilPresent } from "./util"
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'


import { EntityApi, VotingApi } from "@vocdoni/voting"




const config = getConfig()


const inFileName = "zonas.csv"
const outFileName = "zonasProcesses.csv"




type ElectionI = {
    'ID': string
    'zona': string
    'cand1': string
    'cand2': string
    'cand3': string
    'cand4': string
    'cand5': string
}

export type ElectionO = {
    'zona': string
    'ID': string
}

function importInput(): ElectionI[] {
    const data = fs.readFileSync(__dirname + '/' + inFileName,
        { encoding: 'utf8', flag: 'r' })
    const records = parse(data, {
        columns: true,
        skip_empty_lines: true,
        delimiter: ":",
        encoding: "utf-8"

    })
    return records
}

function writeOutput(records: {}[]) : void {
    console.log(records)
    const output  =  stringify(records, {
         header: true,
         delimiter: ':',
     })
     fs.writeFileSync(outFileName, output,
         {encoding:'utf8', flag:'w'})
 }

export async function launchNewVote(process: ElectionI, cspPublicKey: string, cspUri: string, entityWallet: Wallet, gwPool: IGatewayClient) {
    assert(cspPublicKey)
    assert(cspUri)
    console.log("Preparing the new vote metadata")

    const processMetadataPre: ProcessMetadata = JSON.parse(JSON.stringify(ProcessMetadataTemplate)) // make a copy of the template
    processMetadataPre.media.header = "ipfs://Qme64L9QyrvnHJeQcM2Z1L9SSqwX9NtCJUxgPGNkrTEhuF"
    processMetadataPre.questions = [
        {
            title: { default: process.zona },
            description: { default: "" },
            choices: [
            ]
        }
    ]

    for (const [index, name] of ['cand1', 'cand2', 'cand3', 'cand4', 'cand5'].entries()) {

        if (process[name].length > 0) {
            processMetadataPre.questions[0].choices.push(
                { title: { default: process[name] }, value: index },
            )
        }

    }



    // const maxValue = processMetadataPre.questions.reduce((prev, cur) => {
    //     const localMax = cur.choices.reduce((prev, cur) => prev > cur.value ? prev : cur.value, 0)
    //     return localMax > prev ? localMax : prev
    // }, 0)
    const maxValue = processMetadataPre.questions[0].choices.length
    console.log(JSON.stringify(processMetadataPre, null, 2))

    console.log("Getting the block height")
    const currentBlock = await VotingApi.getBlockHeight(gwPool)
    const startBlock = currentBlock + 25
    const blockCount = 60480

    const processParamsPre: INewProcessParams = {
        mode: ProcessMode.make({ autoStart: true, interruptible: true }), // helper
        envelopeType: ProcessEnvelopeType.ENCRYPTED_VOTES, // bit mask
        censusOrigin: ProcessCensusOrigin.OFF_CHAIN_CA,
        metadata: processMetadataPre,
        censusRoot: cspPublicKey,
        censusUri: cspUri,
        startBlock,
        blockCount,
        maxCount: 1,
        maxValue,
        maxTotalCost: 0,
        costExponent: 10000,  // 1.0000
        maxVoteOverwrites: 1,
        paramsSignature: "0x0000000000000000000000000000000000000000000000000000000000000000"
    }

    console.log("Creating the process")
    const processId = await VotingApi.newProcess(processParamsPre, entityWallet, gwPool)
    assert(processId)

    await waitUntilPresent(processId, gwPool)

    // Reading back
    const processParams = await VotingApi.getProcessContractParameters(processId, gwPool)
    assert.strictEqual(processParams.entityAddress?.toLowerCase(), entityWallet.address.toLowerCase())
    assert.strictEqual(processParams.startBlock, processParamsPre.startBlock, "SENT " + JSON.stringify(processParamsPre) + " GOT " + JSON.stringify(processParams))
    assert.strictEqual(processParams.blockCount, processParamsPre.blockCount)
    assert.strictEqual(processParams.censusRoot, processParamsPre.censusRoot)
    assert.strictEqual(processParams.censusUri, processParamsPre.censusUri)

    const processMetadata = await VotingApi.getProcessMetadata(processId, gwPool)

    return { processId, processParams, processMetadata }
    // return { processId}

}


async function main() {

    const processes = importInput()
    console.log(processes)

    // Connect to a GW
    const gwPool = await connectGateways()
    const entityWallet = (new Wallet(config.privateKey)).connect(gwPool.provider)


    console.log("Entity ID", entityWallet.address)



    const entityMetaPost = await EntityApi.getMetadata(entityWallet.address, gwPool)
    console.log(JSON.stringify(entityMetaPost, null, 2));


    await ensureEntityMetadata(entityWallet, gwPool)
    let electionId: string
    let processParams: ProcessContractParameters
    let processMetadata: ProcessMetadata

    // let proc = [processes[0], processes[1]]

    // await Bluebird.Promise.map(proc, async (process: ElectionI, idx: number) => {
    // var results: number[] = await Promise.all(arr.map(async (item): Promise<number> => {
    //     await callAsynchronousOperation(item);
    //     return item + 1;
    // }));
    let results: ElectionO[] = []

    // await Promise.all(proc.map(async (process: ElectionI, idx: number) => {
    for (const [idx, process] of processes.entries()) {
        // // Create a new voting process
        // wait a random time in o
        // const waitTime = Math.trunc( Math.random() * 10000)
        const waitTime = (idx % 10) * 1000
        console.log("waiting time: ", waitTime)
        await new Promise(r => setTimeout(r, waitTime))
        console.log("- Starting process creation for zone: ", process.ID)
        const result = await launchNewVote(process, config.cspPublicKey, config.cspUri, entityWallet, gwPool)
        electionId = result.processId
        processParams = result.processParams
        processMetadata = result.processMetadata
        results.push(
            {
                "zona":process.ID,
                "ID": result.processId
            }
        )
        assert(electionId)
        assert(processParams)
        assert(processMetadata)
        writeFileSync(config.processInfoFilePath + "-" + process.ID + ".json", JSON.stringify({ electionId, processMetadata }, null, 2))
        console.log("- Process ID", electionId)
        console.log("- Process Zone Id", process.ID)
    }

    writeOutput(results)


    // }, { concurrency: 2 })
    // // Create a new voting process


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


