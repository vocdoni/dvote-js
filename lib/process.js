"use strict";

const Blockchain = require('./blockchain');

var process = {
    getMetadata: function(id){
        return Blockchain.getProcessMetadata(id);
    }
};

module.exports = process;