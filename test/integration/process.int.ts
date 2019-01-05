import { assert } from "chai";
import Web3 = require("web3");
import Web3Personal = require("web3-eth-personal");
import * as dvote from "../../src";

import DvoteSmartContracts = require("dvote-smart-contracts");
import { deployContract } from "../testUtils";

describe("Voting Process", () => {
    const blockchainUrl: string = "http://localhost:8545";
    const web3Personal = new Web3Personal(blockchainUrl);
    let votingProcessContractAddress: string = null;

    let process: dvote.Process;
    const inputProcessMetadata = {
        censusFranchiseProofUrl: "http://vocdoni.io/getFranchiseProof",
        censusMerkleRoot: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        censusRequestUrl: "http://vocdoni.io/requesCensus",
        endBlock: 1,
        name: "This is a process name" + Math.random(),
        question: "Blue pill or red pill?",
        startBlock: 0,
        voteEncryptionPrivateKey: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        voteEncryptionPublicKey: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        votesBatch1: "0x1111111111111111111111111111111111111111111111111111111111111111",
        votingOptions: ["0x0000000000000000000000000000000000000000000000000000000000000000",
            "0x1111111111111111111111111111111111111111111111111111111111111111"],
    };

    it("Should deploy a new VotingProcess contract", async () => {

        const accounts = await web3Personal.getAccounts();

        votingProcessContractAddress = await deployContract(
            new Web3(new Web3.providers.HttpProvider(blockchainUrl)),
            DvoteSmartContracts.VotingProcess.abi,
            DvoteSmartContracts.VotingProcess.bytecode,
            accounts[0],
            2600000,
            Web3.utils.toWei("1.2", "Gwei"),
            );

        process = new dvote.Process(blockchainUrl, votingProcessContractAddress);

        assert.isString(votingProcessContractAddress);
    });

    describe("Creates and checks voting process creation", () => {
        let accounts = [];
        let organizer1 = null;
        let organizer2 = null;

        let processId: string;

        before(async () => {
            process = new dvote.Process(blockchainUrl, votingProcessContractAddress);
            accounts = await web3Personal.getAccounts();
            organizer1 = accounts[0];
            organizer2 = accounts[1];
        });

        it("Creates a new process and verify metadata is stored correctly", async () => {
            await process.create(inputProcessMetadata, organizer1);

            processId = await process.getId(inputProcessMetadata.name, organizer1);
            assert.isString(processId, "ProcessId is a string");

            const metadata = await process.getMetadata(processId);

            assert.equal(metadata.name,
                inputProcessMetadata.name,
                "The name should match the input");
            assert.equal(metadata.startBlock,
                inputProcessMetadata.startBlock.valueOf(),
                "The startBlock should match the input");
            assert.equal(metadata.endBlock,
                inputProcessMetadata.endBlock.valueOf(),
                "The endBlock should match the input");
            /*assert.equal(metadata.censusMerkleRoot,
                inputProcessMetadata.censusMerkleRoot,
                "The censusMerkleRoot should match the input");
            assert.equal(metadata.censusFranchiseProofUrl,
                inputProcessMetadata.censusFranchiseProofUrl,
                "The censusFranchiseProofUrl should match the input");
            assert.equal(metadata.censusRequestUrl,
                inputProcessMetadata.censusRequestUrl,
                "The censusRequestUrl should match the input");
                */
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
            await process.create(p, organizer1);

            p = Object.assign({}, inputProcessMetadata);
            p.name += "_3";
            await process.create(p, organizer1);

            p = Object.assign({}, inputProcessMetadata);
            p.name += "_other";
            await process.create(p, organizer2);

            const organizerProcesses = await process.getProcessesIdsByOrganizer(organizer1);
            assert.equal(organizerProcesses.length, 3, "We have 3 processes for the test organitzation");

            const processesDetails = await process.getMultipleMetadata(organizerProcesses);
            assert.equal(processesDetails[1].name, "This is a process name_2", "2nd process name should end with _2");
            assert.equal(processesDetails[2].name, "This is a process name_3", "3rd process name should end with _3");
        });
    });
});
