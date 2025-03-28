import { randomBytes, sign } from 'crypto';
import { generateMnemonic, mnemonicToSeed } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

import { HDKey } from '@scure/bip32';
import { sha256 } from '@noble/hashes/sha256';
import { signHash } from './common.mjs';
import { keccak_256 } from "@noble/hashes/sha3";
import { base58check } from "@scure/base";
import * as common from "./common.mjs";
import * as utils from "../utils/utils.mjs";


const mn = generateMnemonic(wordlist);
const seed = await mnemonicToSeed(mn);

const key = HDKey.fromMasterSeed(seed);
// console.log(HDKey.fromExtendedKey('xpub6GEoXCyfcS69pqqnk9MRAw7sFeaWNwaTG2w1HgzzzhLfV1emXK6MNVGu2LMK4xxR6bjKtJsHHzkNh8k61W25cFcvgBRytfxgNQN2gGSZTmr').publicKey)
// console.log(key.privateExtendedKey, key.publicExtendedKey);

// const receivingKey = key.derive("m/44'/1'/0'/0");
// console.log(receivingKey.privateExtendedKey, receivingKey.publicExtendedKey);

// const transactionKey = HDKey.fromExtendedKey(receivingKey.privateExtendedKey).deriveChild(0);
// console.log(transactionKey.publicKey);
// console.log(transactionKey.publicExtendedKey);

// console.log(checkKey.privateExtendedKey == transactionKey.privateExtendedKey)

// console.log(signHash());


// const msg = randomBytes(32);
// const hash = sha256(msg);
// const sig = checkKey.sign(hash);
// console.log(sig);
// console.log(checkKey.verify(hash, sig));
// console.log(transactionKey.verify(hash, sig));

const transaction = {
    "utxoIns": [
      "xpub6Gtrbs6HbAqzUWXjpvMBBB77q9QED6dCJZugeo4A1LZqwmQ1m2JzxaGWLbgeT5a8N7pwyozcqCfUCWHZH7YV47v13pv6yMZbAmtugnPz3Ct",
      "xpub6Gq8nKiCtjer1RRmaBtCaXME4ebYhc89xTimG1711vfajhCneLPXwpgfUDjJuuTYs7FFMskpC23JJAiNMLpnHysV4bajHB8dSFJx41WBZqr"
    ],
    "utxoOuts": [
      {
        "address": "xpub6GRqKuvrEdtZXJY3FdyyZrnnCxAFxezrCvCFRAyBcaS9Htg4zEE82LJJXHARsRN7UkS1r2Qdhoxg9pnzjitoNnLKyGj2AZqWawbAvQcbFPd",
        "amount": 30,
        "txIn": null
      },
      {
        "address": "xpub6Gq8nKiCtjer4sT2LV4ss7mQQjWZsWBhhiD3K6LVj1df6oSw1k4fax8feHDvbNjXV3ubS6jbiusDD42uvRw51YpDZiwXcjytFxbgcHe2dfF",
        "amount": 80,
        "txIn": null
      }
    ],
    "signatures": [
      "F5vVGjF6PE8HWV3VCubUUFsnUiEgUKEzGqzBzbRPjWB7inhCr6uVhUNkLBSpjVB9LaQXuYhc4PK2cMU7ww3B3XQN9D1Zq",
      "EzG2bdYD4Ji45411G9eKVPad5AzeSKYK4fuuXqzXcyqj6aJcYJdKkAfErZDtMJZH6m58BgGLqdDZq2dHGBnBnKwPbKeDp"
    ],
    "block": null
  }

const tx = utils.getTransactionHash(transaction)
const txHash = '2njD2YPFkwy4CzoEFbr68Tb5TBYv6azfAyMByNbftcrZ4Tyobo'
// console.log(tx);

console.log(common.verifySignature(txHash, transaction.utxoIns[1], transaction.signatures[1]))

// const checkKey = key.derive("M/44'/1'/0'/0/0");
// console.log(checkKey.privateExtendedKey, checkKey.publicExtendedKey);
// console.log(utils.keyToUint8Array(checkKey.publicExtendedKey));

// const base58 = base58check(keccak_256)
// console.log(base58.decode(checkKey.privateExtendedKey))


