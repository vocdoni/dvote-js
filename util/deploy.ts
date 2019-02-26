import config from "../test/config/config-test"
import Web3 = require("web3")

const HDWalletProvider = require("truffle-hdwallet-provider")

import DvoteSmartContracts = require("dvote-smart-contracts")
import { deployContract } from "./index"

async function deployProcess(): Promise<string> {
	const mnemonic = config.MNEMONIC
	const blockchainUrl: string = config.BLOCKCHAIN_URL
	const httpProvider = new HDWalletProvider(mnemonic, blockchainUrl, 0, 10)
	const web3 = new Web3(httpProvider)

	const accounts = await web3.eth.getAccounts()

	const votingProcessContractAddress: string = await deployContract(
		web3,
		DvoteSmartContracts.VotingProcess.abi,
		DvoteSmartContracts.VotingProcess.bytecode,
		accounts[0],
		2600000,
		Web3.utils.toWei("1.2", "Gwei"),
	)

	return votingProcessContractAddress
}


async function deployEntity(): Promise<string> {
	const mnemonic = config.MNEMONIC
	const blockchainUrl: string = config.BLOCKCHAIN_URL
	const httpProvider = new HDWalletProvider(mnemonic, blockchainUrl, 0, 10)
	const web3 = new Web3(httpProvider)

	const accounts = await web3.eth.getAccounts()

	const votingEntityContractAddress: string = await deployContract(
		web3,
		DvoteSmartContracts.VotingEntity.abi,
		DvoteSmartContracts.VotingEntity.bytecode,
		accounts[0],
		3500000,
		Web3.utils.toWei("1.2", "Gwei"),
	)

	return votingEntityContractAddress
}

async function main() {
	try {
		let address
		console.log("Deploying the smart contracts to", config.BLOCKCHAIN_URL)
		
		address = await deployEntity()
		console.log("Entity contract deployed to:", address)

		address = await deployProcess()
		console.log("Process contract deployed to:", address)

		process.exit(0)
	}
	catch (err) {
		console.error("ERROR", err)
	}
}

main()
