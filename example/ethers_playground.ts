// ALTERNATIVE APPROACH WITH ETHERS.JS

import * as ethers from "ethers"
import ganache from "ganache-cli"


const { getConfig } = require("./util")
const config = getConfig()

const { abi: entityResolverAbi, bytecode: entityResolverByteCode } = require("../build/entity-resolver.json")
const { abi: votingProcessAbi, bytecode: votingProcessByteCode } = require("../build/process.json")

async function main() {

	// local blockchain with prefinded accounts
	const provider = new ethers.providers.Web3Provider(ganache.provider({
		mnemonic: config.MNEMONIC
	}))
	// const provider = new ethers.providers.JsonRpcProvider(config.GATEWAY_URL)
	const wallet1 = ethers.Wallet.fromMnemonic(config.MNEMONIC).connect(provider)

	// const privateKey = ethers.Wallet.fromMnemonic(config.MNEMONIC).privateKey
	// const wallet2 = new ethers.Wallet(privateKey, provider)
	// const wallet2 = ethers.Wallet.fromMnemonic(config.MNEMONIC).connect(provider)

	// deploy
	const resolverFactory = new ethers.ContractFactory(entityResolverAbi, entityResolverByteCode, wallet1)
	const processFactory = new ethers.ContractFactory(votingProcessAbi, votingProcessByteCode, wallet1)

	const resolverInstance1 = await resolverFactory.deploy()
	console.log("Resolver deployed at", resolverInstance1.address)

	const processInstance1 = await processFactory.deploy()
	console.log("Process deployed at", processInstance1.address)

	// attach
	const resolverAddress = resolverInstance1.address
	const processAddress = processInstance1.address
	const resolverInstance2 = new ethers.Contract(resolverAddress, entityResolverAbi, wallet1)
	const processInstance2 = new ethers.Contract(processAddress, votingProcessAbi, wallet1)

	// use
	const address = await wallet1.getAddress()
	const entityId = await resolverInstance2.getEntityId(address)
	console.log("ENTITY ID", entityId)

	const processId = await processInstance2.getProcessId(address, 0)
	console.log("PROCESS ID", processId)

	testPublicKey()

	console.log("DONE")
}

function testPublicKey() {
	// https://docs.ethers.io/ethers.js/html/api-advanced.html#cryptographic-operations
	const privateKey = ethers.Wallet.fromMnemonic(config.MNEMONIC).privateKey
	const signingKey = new ethers.utils.SigningKey(privateKey);

	let compressedPublicKey = ethers.utils.computePublicKey(signingKey.publicKey, true);
	let uncompressedPublicKey = ethers.utils.computePublicKey(signingKey.publicKey, false);

	console.log("Compressed public key:", compressedPublicKey);
	// "0x026655feed4d214c261e0a6b554395596f1f1476a77d999560e5a8df9b8a1a3515"

	console.log("Uncompressed public key:", uncompressedPublicKey);
	// "0x046655feed4d214c261e0a6b554395596f1f1476a77d999560e5a8df9b8a1a35" +
	//   "15217e88dd05e938efdd71b2cce322bf01da96cd42087b236e8f5043157a9c068e"

	let address = ethers.utils.computeAddress(signingKey.publicKey);

	console.log('Address: ' + address);
	// "Address: 0x14791697260E4c9A71f18484C9f997B308e59325"
}

main()
	.then(() => process.exit())
	.catch(err => console.error(err))
