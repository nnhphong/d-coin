/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { DatabaseRead } from "../database/database-read.mjs";

import * as utils from "../utils/utils.mjs";
import * as common from "./common.mjs";
import { ValidationError } from "./server.mjs";

export class ClientError extends Error {
  constructor(message) {
    super(message);
    this.name = "ClientError";
  }
}

const MAX_TX = 1000
const MAX_BLOCK = 1000
const MAX_ADDRESS_IDX = 200

export class DotcoinClient {
  /**
   * initializes the Dotcoin client
   * @param {object} config - contains the mnemonic, the mining difficulty, the merkle tree height, the coinbase amount and the NeDB path
   */
  constructor(config) {
    this.mnemonic = config.mnemonic || common.createMnemonic(); // mnemonic for genesis block
    this.difficulty = config.difficulty || 1; // mining difficulty
    this.limit = config.limit || 1024; // each block can have up to 2^10 transactions (including coinbase)
    this.amount = config.amount || 100; // coinbase amount
    this.path = config.path || "data"; // database path
    this.db = new DatabaseRead(this.path);
  }

  /**
   * returns the mnemonic as a string
   */
  getMnemonic() {
    return this.mnemonic
  }

  /**
   * returns the receiving key (i.e public key) as a string
   * @param {number} account - the wallet account index
   */
  async getReceivingAddress(account) {
    return (await common.getReceiveKeys(this.getMnemonic(), account)).publicExtendedKey
    // for (let address_idx = 0; address_idx < MAX_ADDRESS_IDX; address_idx++) {
    //   const address = common.getChildKeys(parKey, address_idx);
    //   const utxo = await this.db.getUtxo(address.publicKey)
      
    //   if (utxo == null) {
    //     return address.publicKey
    //   }
    // }
    
    // return null
  }

  async getChangingAddress(account) {
    return (await common.getChangeKeys(this.getMnemonic(), account)).publicKey
  //   for (let address_idx = 0; address_idx < MAX_ADDRESS_IDX; address_idx++) {
  //     const address = common.getChildKeys(parKey, address_idx);
  //     const utxo = await this.db.getUtxo(address.publicKey)
  //     if (utxo == null) {
  //       return address.publicKey
  //     }
  //   }
    
  //   return null
  }

  async findChildKey(key) {
    for (let address_idx = 0; address_idx < MAX_ADDRESS_IDX; address_idx++) {
      let derived_key = common.getChildKeys(key, address_idx)
      const utxo = await this.db.getUtxo(derived_key.publicKey)
      if (utxo == null) {
        return derived_key.publicKey
      }
    }
    return null
  }

  /**
   * returns the total of dotcoin owns by the wallet account as a number
   * @param {number} account - the wallet account index
   */
  async getBalance(account) {
    let usable = 0, pending = 0
    const key = await this.getReceivingAddress(account)
    const cKey = await this.getChangingAddress(account)
    
    let mp = new Map()    

    // get avaible utxo of this account
    for (let address_index = 0; address_index < MAX_ADDRESS_IDX; address_index++) {
      const address = common.getChildKeys(key, address_index).publicKey
      const utxo = await this.db.getUtxo(address)
      
      if (!utxo) {
        break
      }

      mp.set(utxo.address, true)
    }

    for (let address_index = 0; address_index < MAX_ADDRESS_IDX; address_index++) {
      const address = common.getChildKeys(cKey, address_index).publicKey
      const utxo = await this.db.getUtxo(address)
      
      if (!utxo) {
        break
      }
      
      mp.set(utxo.address, true)
    }

    const pendingTxs = await this.db.getTransactions(0, MAX_TX, -1, true)
    const confirmedTxs = await this.db.getTransactions(0, MAX_TX, -1, false)    

    for (let tx of pendingTxs) {
      if (tx.block != null) continue
      for (let utxo of tx.utxoOuts) {
        if (!mp.has(utxo.address) || utxo.txIn != null) continue
        pending += utxo.amount        
      } 
    }

    for (let tx of confirmedTxs) {
      if (tx.block == null) continue
      for (let utxo of tx.utxoOuts) {
        if (!mp.has(utxo.address) || utxo.txIn != null) continue
        usable += utxo.amount
      }
    }

    return { 
      usable: usable,
      pending: pending
    }
  }

  /**
   * returns a transaction candidate
   * @param {number} account - the wallet account index
   * @param {string} address - recipient's receiving address (i.e public key)
   * @param {number} amount - the number of dotcoin to transfer
   */
  async createTransaction(account, address, amount) {
    let utxoIns = [], prvKeys = [], sigs = [], total = 0
    let rkey = await common.getReceiveKeys(this.getMnemonic(), account)
    let ckey = await common.getChangeKeys(this.getMnemonic(), account)

    for (let address_index = 0; address_index < MAX_ADDRESS_IDX; address_index++) {
      const addr = common.getChildKeys(rkey.publicExtendedKey, address_index).publicKey
      const utxo = await this.db.getUtxo(addr)      

      // take all existing utxo, and add them up to spend
      if (!utxo || total >= amount) {
        break
      }

      // if (utxo.block) console.log(utxo, address_index);
      // only get the one that is usable (mined)
      if (utxo.block && utxo.txIn == null) {
        total += utxo.amount
        
        // get the UTXO address (public key) to spend
        utxoIns.push(utxo.address)

        // derive the UTXO's private key from the account's private key
        const prvKey = common.getChildKeys(rkey.privateExtendedKey, address_index).privateKey
        prvKeys.push(prvKey)
      }
    }

    for (let address_index = 0; address_index < MAX_ADDRESS_IDX; address_index++) {
      const addr = common.getChildKeys(ckey.publicKey, address_index).publicKey
      const utxo = await this.db.getUtxo(addr)      

      if (!utxo || total >= amount) {
        break
      }

      // if (utxo.block) console.log(utxo, address_index);
      if (utxo.block && utxo.txIn == null) {
        total += utxo.amount
        utxoIns.push(utxo.address)
        const prvKey = common.getChildKeys(ckey.privateKey, address_index).privateKey
        prvKeys.push(prvKey)
      }
    }
    

    // we don't have enough money to transfer
    if (total < amount) {
      throw new ValidationError("Not enough dotcoin to transfer")
    }
    
    let utxoOuts = [
      {
        "address": await this.findChildKey(address),
        "amount": amount,
        // "txIn": null,
      }
    ]

    // if there are change, add change 
    const change = total - amount
    if (change > 0) {
      utxoOuts.push({
        // found a UTXO slot in changing account, put this excessive amount in
        "address": await this.findChildKey((await this.getChangingAddress(account))),
        "amount": change,
        // "txIn": null,
      })
    }

    // craft a transaction
    let transaction = {
      "utxoIns": utxoIns,
      "utxoOuts": utxoOuts,
      // "block": null,
    }

    // sign the transaction hash
    let txHash = utils.getTransactionHash(transaction)
    for (let prvKey of prvKeys) {
      sigs.push(common.signHash(txHash, prvKey))
    }

    // put signatures into transaction
    transaction.signatures = sigs

    // hash again the transaction to get the id
    transaction._id = utils.getTransactionHash(transaction)    
    return transaction
  }

  /**
   * returns a block candidate
   * @param {number} account - the wallet account index that will receives the coinbase amount
   */
  async mine(account) {
    let coinbase = {
      "utxoIns": [],
      "utxoOuts": [
        {
          "address": await this.findChildKey((await this.getReceivingAddress(account))),
          "amount": this.amount, // receive the coinbase amount
          // "txIn": null
        }
      ],
      // "block": null,
    }
    
    coinbase._id = utils.getTransactionHash(coinbase)   

    // fetch all transactions (not UTXOs lmao) that is pending (in the mempool) and add them to the block
    // assuming pendingTxs is going to give me a list of transactions
    let pendingTxs = await this.db.getTransactions(0, MAX_TX, -1, true)

    let transactions = []
    for (let tx of pendingTxs) {
      transactions.push(tx._id)
    }
    
    // get the previous block
    let blockList = await this.db.getBlocks(0, MAX_BLOCK, -1), prev = null
    
    if (blockList.length > 0) {
      prev = blockList[0]._id
    }
    
    // build the block
    transactions.push(coinbase._id)
    let block = {
      previous: prev,
      root: utils.getMerkleRoot(transactions),
    } 
    transactions.pop()

    // console.log(block);
    // when finding nonce, the block is already get assigned the id
    common.findNonce(block, this.difficulty)       
    return { block, coinbase, transactions }
  }
}
