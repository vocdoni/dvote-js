import * as assert from "assert"
import { readFileSync } from "fs"
import * as YAML from 'yaml'
import { VocdoniEnvironment } from "@vocdoni/common"

const CONFIG_PATH = "./config.yaml"

export function getConfig(): Config {
    const config: Config = YAML.parse(readFileSync(CONFIG_PATH).toString())
    
    assert(typeof config == "object", "The config file appears to be invalid")
    assert(typeof config.readExistingProcess == "boolean", "config.yaml > readExistingProcess should be a boolean")
    assert(typeof config.stopOnError == "boolean", "config.yaml > stopOnError should be a boolean")
    assert(typeof config.processInfoFilePath == "string", "config.yaml > processInfoFilePath should be a string")
    assert(typeof config.ethNetworkId == "string", "config.yaml > ethNetworkId should be a string")
    assert(typeof config.vocdoniEnvironment == "string", "config.yaml > vocdoniEnvironment should be a string")
    assert(typeof config.tokenAddress == "string", "config.yaml > tokenAddress should be a string")
    // assert(typeof config.tokenBalanceMappingPosition == "number", "config.yaml > tokenBalanceMappingPosition should be a number")
    assert(Array.isArray(config.privKeys) && config.privKeys.length, "config.yaml > privKeys should be an array of strings")
    assert(typeof config.bootnodesUrlRw == "string", "config.yaml > bootnodesUrlRw should be a string")
    assert(!config.dvoteGatewayUri || typeof config.dvoteGatewayUri == "string", "config.yaml > dvoteGatewayUri should be a string")
    assert(!config.dvoteGatewayPublicKey || typeof config.dvoteGatewayPublicKey == "string", "config.yaml > dvoteGatewayPublicKey should be a string")
    assert(!config.web3Uri || typeof config.web3Uri == "string", "config.yaml > web3Uri should be a string")
    assert(typeof config.oracleUri == "string", "config.yaml > oracleUri should be a string")
    assert(typeof config.encryptedVote == "boolean", "config.yaml > encryptedVote should be a boolean")
    assert(typeof config.votesPattern == "string", "config.yaml > votesPattern should be a string")
    return config
}

type Config = {
    readExistingProcess: boolean
    stopOnError: boolean

    processInfoFilePath: string

    ethNetworkId: string
    vocdoniEnvironment: VocdoniEnvironment
    tokenAddress: string
    tokenBalanceMappingPosition?: number
    privKeys: string[]

    bootnodesUrlRw: string
    dvoteGatewayUri: string
    dvoteGatewayPublicKey: string
    web3Uri: string
    oracleUri: string

    encryptedVote: boolean
    votesPattern: "all-0" | "all-1" | "all-2" | "all-even" | "incremental"
}
