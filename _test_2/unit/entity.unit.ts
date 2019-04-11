import { assert } from "chai";
import DvoteSmartContracts = require("dvote-smart-contracts");
import Web3 = require("web3");
import config from "../config";

const HDWalletProvider = require("truffle-hdwallet-provider");

import * as dvote from "../../src";
import { deployContract } from "../../util";

describe("Entity Resolver", () => {

    const mnemonic = config.MNEMONIC
    const blockchainUrl: string = config.BLOCKCHAIN_URL;
    const httpProvider = new HDWalletProvider(mnemonic, blockchainUrl, 0, 10);
    const web3 = new Web3(httpProvider);

    let resolverAddress: string = null;

    let accounts = [];
    let entity1Address = null;

    let entity: dvote.EntityResolver;

    before(async () => {
        accounts = await web3.eth.getAccounts();
        entity1Address = accounts[0];

        resolverAddress = await deployContract(
            web3,
            DvoteSmartContracts.EntityResolver.abi,
            DvoteSmartContracts.EntityResolver.bytecode,
            accounts[0],
            3500000,
            Web3.utils.toWei("1.2", "Gwei"),
        );

        console.log("Entity contract deployed to:", resolverAddress)
    });

    describe("Sets entity-name", () => {

        before(() => {
            entity = new dvote.EntityResolver(web3, resolverAddress, DvoteSmartContracts.EntityResolver.abi);
        });

        it("Creates a new entity and verify metadata is stored correctly", async () => {

            const entity = new EntityMetadata()
            await entity.setName(inputEntity, entity1Address, );
            const metadata = await entity.make(entity1Address);

        });
    });
});
