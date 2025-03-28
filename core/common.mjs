/* Copyright (C) 2023 Thierry Sans - All Rights Reserved
 */

import { generateMnemonic, mnemonicToSeed } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { HDKey } from "@scure/bip32";
import { randomBytes } from "crypto";
import { keccak_256 } from "@noble/hashes/sha3";
import { base58check } from "@scure/base";

import * as utils from "../utils/utils.mjs";
import { create } from "domain";

const base58 = base58check(keccak_256);

/**
 * returns the mnemonic as a string
 */
export function createMnemonic() {
  return generateMnemonic(wordlist);
}

/**
 * returns the receiving key for the given wallet's account
 * @param {string} mnemonic - the wallet's mnemonic phrase
 * @param {number} account - the wallet account index
 */
export async function getReceiveKeys(mnemonic, account) {
  const seed = await mnemonicToSeed(mnemonic)
  const hdkey = HDKey.fromMasterSeed(seed)
  const key = hdkey.derive(`M/44'/1'/${account}'/1`)

  return key
}

/**
 * returns the changing key pair (public and private) for the given wallet's account
 * @param {string} mnemonic - the wallet's mnemonic phrase
 * @param {number} account - the wallet account index
 */
export async function getChangeKeys(mnemonic, account) {
  const seed = await mnemonicToSeed(mnemonic)
  const hdkey = HDKey.fromMasterSeed(seed)
  const key = hdkey.derive(`M/44'/1'/${account}'/0`)
    
  return {
    publicKey: key.publicExtendedKey, 
    privateKey: key.privateExtendedKey
  }
}

/**
 * returns the child key(s) for the given parent's key
 * if the parent's key is a public key, it returns the child public key only {publicKey: ...}
 * if the parent's key is a private key, it returns both private and public key {privateKey:, publicKey: }
 * @param {string} key - base58-encoded key (either private or public)
 * @param {number} index - the child key index
 */
export function getChildKeys(key, index) {
  const hdKey = HDKey.fromExtendedKey(key)
  const childKey = hdKey.deriveChild(index)
  
  if (key.substring(0, 4) == 'xprv') {
    return {
      privateKey: childKey.privateExtendedKey, 
      publicKey: childKey.publicExtendedKey
    }
  }

  return {
    publicKey: childKey.publicExtendedKey
  }
}

/**
 * returns the base58-encoded signature for a given hash
 * @param {string} hash - base58-encoded hash
 * @param {string} privateKey - base58-encoded private key
 */
export function signHash(hash, privateKey) {  
  const hashBytes = base58.decode(hash)
  const key = HDKey.fromExtendedKey(privateKey)
  
  const signature = key.sign(hashBytes)
  return base58.encode(signature)
}

/**
 * returns true or false whether the signature match a given hash
 * @param {string} hash - base58-encoded hash
 * @param {string} publicKey - base58-encoded public key
 * @param {string} sig - base58-encoded signature
 */
export function verifySignature(hash, publicKey, sig) {
  const key = HDKey.fromExtendedKey(publicKey)
  const hashBytes = base58.decode(hash)
  const sigBytes = base58.decode(sig)
  return key.verify(hashBytes, sigBytes)
}

/**
 * returns the complete block data that includes a valid nonce that matches the difficulty and the block _id
 * @param {object} block - incomplete block that includes the previous block _id, the merkle root hash and the timestamp
 * @param {number} difficulty - the number of '1' that should prefix the block _id;
 */
export function findNonce(block, difficulty) {
  let hash;
  do {
    let nonce = new Uint8Array(randomBytes(32))
    block.nonce = base58.encode(nonce)
    hash = utils.getBlockHash(block)
  } while (hash.substring(0, difficulty) !== '1'.repeat(difficulty))
  block._id = hash
  return block
}
