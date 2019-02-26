import { assert } from "chai";
import config from "../config";
import DvoteSmartContracts = require("dvote-smart-contracts");
import Web3 = require("web3");

const HDWalletProvider = require("truffle-hdwallet-provider");

import * as dvote from "../../src";
import { deployContract } from "../../util";

describe("Voting Entities", () => {

    const mnemonic = config.MNEMONIC
    const blockchainUrl: string = config.BLOCKCHAIN_URL;
    const httpProvider = new HDWalletProvider(mnemonic, blockchainUrl, 0, 10);
    const web3 = new Web3(httpProvider);

    let votingEntityContractAddress: string = null;

    let accounts = [];
    let organizer1 = null;

    let entity: dvote.Entity;
    const inputEntity = {
        censusRequestUrl: "https://organization.testnet.vocdoni.io/census-register",
        name: "The Voting Organization",
    };

    before(async () => {
        accounts = await web3.eth.getAccounts();
        organizer1 = accounts[0];

        votingEntityContractAddress = await deployContract(
            web3,
            DvoteSmartContracts.VotingEntity.abi,
            DvoteSmartContracts.VotingEntity.bytecode,
            accounts[0],
            3500000,
            Web3.utils.toWei("1.2", "Gwei"),
        );

        console.log("Entity contract deployed to:", votingEntityContractAddress)
    });

    describe("Creates and checks voting entity creation", () => {

        before(() => {
            entity = new dvote.Entity(web3, votingEntityContractAddress);
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

            const entities = await entity.getAll()
            assert.equal(entities.length, 1, "There should only be one entity");
            assert.equal(typeof entities[0].address, "string", "Entities should have an address");
            assert.equal(typeof entities[0].name, "string", "Entities should have a name");
            assert.equal(typeof entities[0].censusRequestUrl, "string", "Entities should have a censusRequestUrl");
            assert.equal(typeof entities[0].exists, "boolean", "Entities should exist");
            assert(entities[0].address.match(/^0x[0-9A-Fa-f]{40}$/), "ID's should be an ethereum address");
        });
    });
});
