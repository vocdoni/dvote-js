import {assert} from "chai";
import Web3 = require("web3");
import Config from "../../src/utils/config";

import Process from "../../src/process";

describe("Voting Process", () => {
  const blockchainUrl: string = Config.BLOCKCHAIN_URL;
  const votingProcessContractPath: string = Config.VOTING_PROCESS_CONTRACT_PATH;
  const votingProcessContractAddress: string = Config.VOTING_PROCESS_CONTRACT_ADDRESS;
  let process: Process;
  const inputProcessMetadata: object = {
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
    let createdProcessId: string = "";

    before(() => {
      process = new Process(blockchainUrl, votingProcessContractPath, votingProcessContractAddress);
    });

    it("Creates a new process", async () => {
      const organizerAddress: string = "0x000000"; // TODO: A valid account with some Eth!
      createdProcessId = await process.create(inputProcessMetadata, organizerAddress);
      // TODO: Can we return the id on creation?
      // TODO: Can we validate that id?
    });

    it("Metadata is stored correctly", async () => {
      const metadata: object = await process.getMetadata(createdProcessId);
      assert.equal(metadata, inputProcessMetadata);
    });
  });
});
