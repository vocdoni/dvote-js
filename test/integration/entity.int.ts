import {assert} from "chai";
import Web3 = require("web3");

import * as dvote from "../../src";

describe("Voting Entities", () => {
    const blockchainUrl: string = "http://localhost:8545";
    const votingEntityContractAddress: string = "0x8Cb2dF65E5D8ebb2F23D3aABB9402CcCdD096f2D";
    const votingEntityOrganizerAddress: string = "0x29fff43288136a7348b99efb1f99e92c53a306f1";

    let entity: dvote.Entity;
    const inputEntity = {
        name: "This is an Entity name",
    };

    describe("Creates and checks voting entity creation", () => {

        before(() => {
            entity = new dvote.Entity(blockchainUrl, votingEntityContractAddress);
        });

        it("Creates a new process and verify metadata is stored correctly", async () => {
            await entity.create(inputEntity, votingEntityOrganizerAddress);
            const metadata = await entity.get(votingEntityOrganizerAddress);

            assert.equal(metadata.name, inputEntity.name, "The name should match the input");
        });
    });
});
