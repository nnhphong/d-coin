/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { DatabaseWrite } from "../database/database-write.mjs";

import * as utils from "../utils/utils.mjs";
import * as common from "./common.mjs";

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

const MAX_TX = 1000
const MAX_BLOCK = 1000
const MAX_ADDRESS_IDX = 200

export class DotcoinServer {
  /**
   * initializes the Dotcoin server
   * @param {object} config - contains the mining difficulty, the merkle tree height, the coinbase amount and the NeDB path
   */
  constructor(config) {
    this.difficulty = config.difficulty || 1;
    this.limit = config.limit || 1024 // each block can have up to 2^10 transactions (including coinbase)
    this.amount = config.amount || 100; // coinbase amount
    this.path = config.path || "data";
    this.db = new DatabaseWrite(this.path);
  }

  async verifyTransaction(txParams) {
    if (txParams._id == null || txParams.utxoIns == null || txParams.utxoOuts == null) {
      throw new ValidationError("Transaction's structure is not complete")
    }

    if (txParams.block != null) {
      throw new ValidationError('Transaction should be unconfirmed (i.e block == null)')
    }

    for (let txOut of txParams.utxoOuts) {
      if (txOut.address == null) {
        throw new ValidationError("UTXO's address is missing")
      }
      if (txOut.amount <= 0) {
        throw new ValidationError("UTXO's amount is invalid")
      }
    }

    // verifiy ownership
    if (txParams.utxoIns.length > 0 && txParams.utxoIns.length != txParams.signatures.length) {
      throw new ValidationError("The number of signatures and number of UTXOIns does not match")
    }

    // verify digital signatures
    let tx = { 
      "utxoIns": txParams.utxoIns,
      "utxoOuts": txParams.utxoOuts,
      "block": txParams.block,
    }
    const txHash = utils.getTransactionHash(tx)
    for (let i = 0; i < txParams.utxoIns.length; i++) {
      if (!common.verifySignature(txHash, txParams.utxoIns[i], txParams.signatures[i])) {
        throw new ValidationError("Invalid digital signatures")
      }
    }

    if ("signatures" in txParams) {
      tx.signatures = txParams.signatures
    }
    if (txParams._id != utils.getTransactionHash(tx)) {
      throw new ValidationError("Transaction ID is not valid")
    }

    // verify validity of utxo
    const pendingTxs = await this.db.getTransactions(0, MAX_TX, -1, true)
    let mp = new Map()

    if (pendingTxs != null) {
      for (let pendingTx of pendingTxs) {
        for (let txOut of pendingTx.utxoOuts) {
          mp.set(txOut.address, true)
        }
      }
    }

    for (let txIn of txParams.utxoIns) {
      const original_tx = await this.db.getUtxo(txIn)
      if (original_tx == null) {
        throw new ValidationError("Spending a UTXO that does not exist")
      }

      if (original_tx.txIn != null) {
        throw new ValidationError("UTXO was already spent")
      }

      if (mp.has(original_tx.address)) {
        throw new ValidationError("Spending a pending UTXO")
      }
    }

    let uniqTxIn = [...new Set(txParams.utxoIns)]
    if (uniqTxIn.length != txParams.utxoIns.length) {
      throw new ValidationError("Duplicated UTXOIn in the same transaction")
    }

    // verify unique transaction id
    tx = await this.db.getTransaction(txParams._id)
    if (tx != null) {
      throw new ValidationError("Duplicated transaction ID")
    }

    // verify balance
    let balance = 0
    for (let txIn of txParams.utxoIns) {
      let tx = await this.db.getUtxo(txIn)
      balance += tx.amount
    }

    for (let txOut of txParams.utxoOuts) {
      if (txOut.amount <= 0) {
        throw new ValidationError("Output amount must be positive")
      }
      balance -= txOut.amount
    }

    if (balance < 0 && txParams.utxoIns.length > 0) {
      throw new ValidationError("Sum of inputs can't be less than sum of outputs")
    }
  }

  /**
   * verifies (!!) and adds a transaction to the transaction pool
   * @param {object} txParams - the transaction data
   */
  async addTransaction(txParams) {
    // check if it has all required fields
    await this.verifyTransaction(txParams)       
    txParams.block = null 
    await this.db.addTransaction(txParams)
    await this.db.spendUtxos(txParams._id, txParams.utxoIns) 
  }
  
  async verifyBlock(block, coinbase, transactions) {
    // check the structure of a block
    if (block._id == null || block.root == null || block.nonce == null) {
      throw new ValidationError("Block's structure is not complete");
    }

    // verify the transactions
    for (let txID of transactions) {
      await this.verifyTransaction(txID)
    }

    // verify the validity of previous
    let blockList = await this.db.getBlocks(0, MAX_BLOCK, -1), prev = null    
    if (blockList.length > 0) {
      prev = blockList[0]._id
    }

    if (prev != block.previous) {
      throw new ValidationError("Block has invalid previous")
    }

    // verify the validity of the merkel root
    transactions.push(coinbase._id)
    if (block.root != utils.getMerkleRoot(transactions)) {
      console.log(block.root, utils.getMerkleRoot(transactions));
      
      throw new ValidationError("Block has invalid merkel root")
    }
    transactions.pop()

    // verify the validity of the nonce && id
    let tmpBlock = {
      previous: block.previous,
      root: block.root,
      nonce: block.nonce,
    }

    let tmpBlockHash = utils.getBlockHash(tmpBlock)
    if (tmpBlockHash.substring(0, this.difficulty) != '1'.repeat(this.difficulty)) {
      throw new ValidationError("Block hash does not meet the difficulty of ", this.difficulty)
    }

    if (tmpBlockHash != block._id) {
      throw new ValidationError("Block id does not match with block hash")
    }

    // verify the coinbase transaction
    let coinbase_flag = false
    for (let txID of transactions) {
      let tx = await this.db.getTransaction(txID)
      if (tx.utxoIns == 0) {
        if (coinbase_flag) {
          throw new ValidationError("There are more than one coinbase transaction in the block")
        }

        if (tx.amount != this.amount) {
          throw new ValidationError("The coinbase amount in the block is incorrect")
        }

        coinbase_flag = true
      }
    }
  }

  /**
   * verifies (!!) and adds a block to the database
   * it should also verify (!!) add the coinbase transaction and verify (!!) and update all transactions confirmed by the block
   * @param {object} block - the block data
   * @param {object} coinbase - the block's coinbase transaction
   * @param {array<string>} transactions - the list of transaction _ids (non including the coinbase one) that are confirmed by the block
   */
  async addBlock(block, coinbase, transactions) {
    this.verifyTransaction(coinbase)
    this.verifyBlock(block, coinbase, transactions)

    await this.addTransaction(coinbase)
    await this.db.confirmTransactions(block._id, [coinbase._id])
    await this.db.confirmTransactions(block._id, transactions)

    return await this.db.addBlock(block)
  }

  /**
   * retrieves a subset of blocks 
   * @param {number} page - the page index
   * @param {numbers} limit - the number of elements per page
   * @param {object} sort - either starting from the oldest one inserted (sort=1) or the latest one inserted (sort=-1)
   */
  async getBlocks(page, limit, sort = 1) {
    return this.db.getBlocks(page, limit, sort);
  }

  /**
   * retrieves the block given its hash
   * @param {string} hash - block's hash
   */
  async getBlock(hash) {
    return this.db.getBlock(hash);
  }

  /**
   * retrieves a subset of transactions
   * @param {number} page - the page index
   * @param {numbers} limit - the number of elements per page
   * @param {object} sort - either starting from the oldest one inserted (sort=1) or the latest one inserted (sort=-1)
   * @param {boolean} unconfirmed - if true, returns only the unconfirmed ones (not mined yet i.e for which the field block == null)
   */
  async getTransactions(page, limit, sort = 1, unconfirmed = false) {
    return this.db.getTransactions(page, limit, sort, unconfirmed);
  }

  /**
   * retrieves the transaction given its hash
   * @param {string} hash - transaction's hash
   */
  async getTransaction(hash) {
    return this.db.getTransaction(hash);
  }

  /**
   * retrieves the utxo (i.e transaction output) for the given address
   * @param {string} address - the address (i.e the public key) of the recipient
   */
  async getUtxo(address) {
    return this.db.getUtxo(address);
  }

  /**
   * erase the directory that stores the NeDB files
   */
  destroy() {
    this.db.destroy();
  }
}
