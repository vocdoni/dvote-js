import { assert } from "chai";
import Web3 = require("web3");
import Web3Personal = require("web3-eth-personal");

import * as dvote from "../../src";

describe("Voting Entities", () => {
    const blockchainUrl: string = "http://localhost:8545";
    const web3Personal = new Web3Personal(blockchainUrl);

    const votingEntityContractAddress: string = "0x1EC35A3150d562403a27A66D3906205Bef4728d0";

    let accounts = [];
    let organizer1 = null;
    let organizer2 = null;

    let entity: dvote.Entity;
    const inputEntity = {
        name: "This is an Entity name",
    };

    before(async () => {
        accounts = await web3Personal.getAccounts();
        organizer1 = accounts[0];
        organizer2 = accounts[1];
    });

    describe("Creates and checks voting entity creation", () => {

        before(() => {
            entity = new dvote.Entity(blockchainUrl, votingEntityContractAddress);
        });

        it("Creates a new process and verify metadata is stored correctly", async () => {
            await entity.create(inputEntity, organizer1);
            const metadata = await entity.get(organizer1);

            assert.equal(metadata.name, inputEntity.name, "The name should match the input");
        });
    });
});
