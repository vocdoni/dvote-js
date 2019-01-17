import { assert } from "chai";
import DvoteSmartContracts = require("dvote-smart-contracts");
import Web3 = require("web3");
import Web3Personal = require("web3-eth-personal");

import * as dvote from "../../src";
import { deployContract } from "../testUtils";

describe("Voting Entities", () => {
    const blockchainUrl: string = process.env.BLOCKCHAIN_URL;
    const web3Personal = new Web3Personal(blockchainUrl);

    let votingEntityContractAddress: string = null;

    let accounts = [];
    let organizer1 = null;

    let entity: dvote.Entity;
    const inputEntity = {
        censusRequestUrl: "http://vocdoni.io/requestCenus",
        name: "This is an Entity name",
    };

    before(async () => {
        accounts = await web3Personal.getAccounts();
        organizer1 = accounts[0];

        votingEntityContractAddress = await deployContract(
            new Web3(new Web3.providers.HttpProvider(blockchainUrl)),
            DvoteSmartContracts.VotingEntity.abi,
            DvoteSmartContracts.VotingEntity.bytecode,
            accounts[0],
            3500000,
            Web3.utils.toWei("1.2", "Gwei"),
            );

    });

    describe("Creates and checks voting entity creation", () => {

        before(() => {
            entity = new dvote.Entity(blockchainUrl, votingEntityContractAddress);
        });

        it("Creates a new entity and verify metadata is stored correctly", async () => {
            await entity.create(inputEntity, organizer1);
            const metadata = await entity.get(organizer1);

            assert.equal(metadata.name, inputEntity.name, "The name should match the input");
            assert.equal(
                metadata.censusRequestUrl,
                inputEntity.censusRequestUrl,
                "The censusUrl should match the input",
            );
        });
    });
});
