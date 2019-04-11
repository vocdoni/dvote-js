export const deployContract = async (web3, abi, bytecode, fromAddress: string, gasCostWei: number, gasPriceWei) => {

    const contract = new web3.eth.Contract(abi);
    const deployTransaction = await contract.deploy({
        data: bytecode,
    });

    const instance = await deployTransaction.send({
        from: fromAddress,
        gas: gasCostWei,
        gasPrice: gasPriceWei,
    });

    const address = instance.options.address;

    return address;
};
