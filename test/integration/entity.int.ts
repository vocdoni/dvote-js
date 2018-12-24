import {assert} from "chai";
import Web3 = require("web3");

import * as dvote from "../../src";

describe("Voting Entities", () => {
    const blockchainUrl: string = "http://localhost:8545";
    const votingEntityContractPath: string = "/contracts/VotingEntity.json";
    const votingEntityContractAddress: string = "0xDC4B53bcb5C9dFfd65a7d301087b0d208f7d6F41";
    const votingEntityOrganizerAddress: string = "0x8ebdd1f6d4f415a8577a7b2d610991f9678731a0";
    const votingEntityOrganizerAddress2: string = "0x945cab676cbf56f98f2a98a36dcbefd7b9e01e0d";

    let entity: dvote.Entity;
    const inputEntity = {
        name: "This is an Entity name",
    };

    describe("Creates and checks voting entity creation", () => {

        before(() => {
            entity = new dvote.Entity(blockchainUrl, votingEntityContractPath, votingEntityContractAddress);
        });

        it("Creates a new process and verify metadata is stored correctly", async () => {
            await entity.create(inputEntity, votingEntityOrganizerAddress);
            const metadata = await entity.get(votingEntityOrganizerAddress);

            assert.equal(metadata.name, inputEntity.name, "The name should match the input");
        });
    });
});
