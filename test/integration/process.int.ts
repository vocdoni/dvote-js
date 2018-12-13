import {assert} from "chai";
import Web3 = require("web3");

import Process from "../../src/process";

describe("Voting Process", () => {
    const blockchainUrl: string = "http://localhost:8545";
    const votingProcessContractPath: string = "/contracts/VotingProcess.json";
    const votingProcessContractAddress: string = "0xc04Ef528486477c3351D9aEFf0B0852786ad8F58";
    const votingProcessOrganzerAddress: string = "0xcfa7023c3e1ace99f008abbc19aec28f150e8816";

    let process: Process;
    const inputProcessMetadata = {
        censusMerkleRoot: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        endBlock: 1,
        name: "This is a process name",
        question: "Blue pill or red pill?",
        startBlock: 0,
        voteEncryptionPrivateKey: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        voteEncryptionPublicKey: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        votesBatch1: "0x1111111111111111111111111111111111111111111111111111111111111111",
        votingOptions: ["0x0000000000000000000000000000000000000000000000000000000000000000",
                        "0x1111111111111111111111111111111111111111111111111111111111111111"],
    };

    describe("Creates and checks voting process creation", () => {
        let processId: string;

        before(() => {
            process = new Process(blockchainUrl, votingProcessContractPath, votingProcessContractAddress);
        });

        it("Creates a new process and verify metadata is stored correctly", async () => {
            await process.create(inputProcessMetadata, votingProcessOrganzerAddress);
            processId = await process.getId(inputProcessMetadata.name, votingProcessOrganzerAddress);
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
            assert.equal(metadata.censusMerkleRoot,
                        inputProcessMetadata.censusMerkleRoot,
                        "The censusMerkleRoot should match the input");
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
    });
});
