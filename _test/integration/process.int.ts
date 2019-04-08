import { assert } from "chai";
import config from "../config";
import Web3 = require("web3");
import * as dvote from "../../src";

const HDWalletProvider = require("truffle-hdwallet-provider");

import DvoteSmartContracts = require("dvote-smart-contracts");
import { deployContract } from "../../util";

describe("Voting Process", () => {

    const mnemonic = config.MNEMONIC
    const blockchainUrl: string = config.BLOCKCHAIN_URL;
    const httpProvider = new HDWalletProvider(mnemonic, blockchainUrl, 0, 10);
    const web3 = new Web3(httpProvider);

    let votingProcessContractAddress: string = null;

    let votingProcess: dvote.Process;
    const inputProcessMetadata = {
        censusProofUrl: "https://census.testnet.vocdoni.io/",
        censusMerkleRoot: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        censusRequestUrl: "http://organizer.testnet.vocdoni.io/census-register",
        name: "Global Science Poll",
        question: "Who's the boss of bosses?",
        startBlock: 0,
        endBlock: 100,
        voteEncryptionPrivateKey: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        voteEncryptionPublicKey: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        votesBatch1: "0x1111111111111111111111111111111111111111111111111111111111111111",
        votingOptions: ["Isaac Newton", "Albert Einstein", "Nikola Tesla", "Alan Turing"],
    };

    it("Should deploy a new VotingProcess contract", async () => {

        const accounts = await web3.eth.getAccounts();

        votingProcessContractAddress = await deployContract(
            web3,
            DvoteSmartContracts.VotingProcess.abi,
            DvoteSmartContracts.VotingProcess.bytecode,
            accounts[0],
            2600000,
            Web3.utils.toWei("1.2", "Gwei"),
        );

        votingProcess = new dvote.Process(web3, votingProcessContractAddress);

        assert.isString(votingProcessContractAddress);
        console.log("Process contract deployed to:", votingProcessContractAddress)
    });

    describe("Creates and checks voting process creation", () => {
        let accounts = [];
        let organizer1 = null;
        let organizer2 = null;

        let processId: string;

        before(async () => {
            votingProcess = new dvote.Process(web3, votingProcessContractAddress);
            const accounts = await web3.eth.getAccounts();
            organizer1 = accounts[0];
            organizer2 = accounts[1];
        });

        it("Creates a new process and verify metadata is stored correctly", async () => {
            await votingProcess.create(inputProcessMetadata, organizer1);

            processId = await votingProcess.getId(inputProcessMetadata.name, organizer1);
            assert.isString(processId, "ProcessId is a string");

            const metadata = await votingProcess.getMetadata(processId);

            assert.equal(metadata.name,
                inputProcessMetadata.name,
                "The name should match the input");
            assert.equal(metadata.startBlock,
                inputProcessMetadata.startBlock.valueOf(),
                "The startBlock should match the input");
            assert.equal(metadata.endBlock,
                inputProcessMetadata.endBlock.valueOf(),
                "The endBlock should match the input");
            assert.equal(metadata.question,
                inputProcessMetadata.question,
                "The question should match the input");
            assert.equal(metadata.votingOptions[0],
                inputProcessMetadata.votingOptions[0],
                "The votingOptions[0] should match the input");
            assert.equal(metadata.votingOptions[1],
                inputProcessMetadata.votingOptions[1],
                "The votingOptions[1] should match the input");
            assert.equal(metadata.voteEncryptionPublicKey,
                inputProcessMetadata.voteEncryptionPublicKey,
                "The voteEncryptionPublicKey should match the input");
        });

        it("Creates some more processes and checks they are listed correctly", async () => {
            let p = Object.assign({}, inputProcessMetadata);
            p.name += "_2";
            await votingProcess.create(p, organizer1);

            p = Object.assign({}, inputProcessMetadata);
            p.name += "_3";
            await votingProcess.create(p, organizer1);

            p = Object.assign({}, inputProcessMetadata);
            p.name += "_other";
            await votingProcess.create(p, organizer2);

            const organizerProcesses = await votingProcess.getProcessesIdsByOrganizer(organizer1);
            assert.equal(organizerProcesses.length, 3, "We have 3 processes for the test organitzation");

            // We get the first one manually, just in case
            const process0Details = await votingProcess.getMetadata(organizerProcesses[0]);
            assert.equal(process0Details.name, inputProcessMetadata.name, "1st process name should end normally");

            // Testing the rest
            const processesDetails = await votingProcess.getMultipleMetadata(organizerProcesses);
            assert.equal(processesDetails[1].name, "This is a process name_2", "2nd process name should end with _2");
            assert.equal(processesDetails[2].name, "This is a process name_3", "3rd process name should end with _3");

        });
    });
});
