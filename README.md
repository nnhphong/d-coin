# d-coin

In this project, we propose to implement _d-coin_, a blockchain based on the UTXO model (like [Bitcoin](https://bitcoin.org/Bitcoin.pdf)).

This blockchain has a particularity that it does not allow the same address to be used twice. This means that any address can only appear once in a transaction output (UTXO) and cannot be reused.

## Datatypes

### Transactions

Here is a simple example of a transaction:

```
{
  _id: '2a9Tp4AwmcXShpF61ZZTa1y4SN4QTPUXr5QB2ubLEeyuijb6Ag',
  utxoIns: [],
  utxoOuts: [
    {
      amount: 100,
      address: 'xpub6GpvRLK3MApXhV4ecC8LpnPkiSbjSeaAhKFE7GqTurvkAZUkZJ3DCrajs9EHZXSrGFWDVtYjz4zeRbdpGWtXLDHjRwDP2WPyrvrjUwGug22',
      txIn: '2qKV1jU6YsQDg4e6S54oD7wy94cPpH9RfoYYd5LqfAiyDxSGBX'
    }
  ],
  signatures: [],
  block: '1Hi8SooEDsVQMnqFhVrqK7HJ1nfTghkGh56mkFVGEC8V48pgg'
}
```

We can tell that:

- this transaction is a coinbase transaction since `utxIns` is empty
- it has been confirmed in the mined block id `1Hi8S...`
- it contains one UTXO (in `utxOuts`) of 100 d-coins that has already been spent in another transaction `'2qKV1...`

Let take another example:

```
{
  "_id": "2eqRyvhT21TVQVHtnYTHihVFxaoRGZr4S1S7PnL4jYtnprhyJT",
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
```

We can tell that:

- it is unconfirmed i.e not mined into a block yet since the `block` field is `null`
- it creates two UTXOs: one of the amount 30 for the recipient's address `xpub6Gq8nK...` and another of the amount 80 for the recipient's address `xpub6Gq8nKiCt...`. These UTXOs have not been spent yet since their `txIn` field is missing (and it cannot be otherwise since the transaction has not been mined yet).
- it takes two addresses as inputs. These addresses are necessarily part of UTXOs from one or several past but yet confirmed transactions. These input addresses have UTXOs that is necessarily equal to 110 d-coins (the total of output UTXOs)

Each transaction can have up to 100 (maximum) `utxoIns` elements, 100 `signatures` elements and 100 `utxoOuts` elements. 

### Blocks

Blocks are mined

```
{
  _id: '1125Nt69jRRc6K6GK5aUie5EVwimj6ZQT71zMLBtmygxcg7Vc',
  previous: '112CGjXX1xYhwehSWNn8AbqeFpL31XFXCJK1NTW9WLP82TANS',
  root: 'wjLjDqr8XLCiWDaifFkfdCoUijF7qhH3ge8LMbHQmJaMjz5Yu',
  nonce: 'Xe3aTrBdDyT4rb8Nk2p95AWEY78hrDx8F3gELJBXXTpXTBG6'
}
```

### Addresses, ids, nonces and signatures

Addresses, ids, nonces and signatures are all encoded using [Base58 encoding](https://en.bitcoin.it/wiki/Base58Check_encoding). The package [@scure/base](https://www.npmjs.com/package/@scure/base) provides primitives to encode and decode Base58.

```
import { base58check } from "@scure/base";
const base58 = base58check(keccak_256);

const nonce = new Uint8Array(randomBytes(32));
const nonceEncoded = base58.encode(nonce);
const nonceDecoded = base58.decode(nonce);
```

Transaction ids and block ids are _Keccak256__ hashes encoded in Base58. The package [@noble/hashes](https://www.npmjs.com/package/@noble/hashes) provides a primitive `keccak_256` hashing. In `utils/utils.mjs`, we provide two methods `getTransactionHash` and `getBlockHash` that returns base58-encoded hash.

Adresses are base58-encoded public keys. The NPM package [@scure/bip32](https://www.npmjs.com/package/@scure/bip32) can export base58-encoded keys directly using `privateExtendedKey()` and `publicExtendedKey()`.

Signatures are also encoded in Base58. The @scure/bip32 package provide a primitive to sign a decoded hash (as an `Uint8Array`). The output signature is also an `Uint8Array` that can be encoded into Base58 using @scure/base package.

### The Client Wallet

The easiest way to get you started is to implement the client. By the end of this task, you should be able to create a wallet, get an account balance, make a transaction and mine a block.

The client is essentially a system that manages BIP44 keys. Recalling from the course, BIP44 keys are derived from a BIP 39 mnemonic phrase and a BIP32 key derivation path.

A BIP 44 path has the following structure:

```
m / purpose' / cointype' / account' / change / address_index
```

In our case:

- `purpose` will be fixed to `44'` (hardened)
- `cointype` will be fixed to `1'` (hardened) which corresponds to the _testnet_ cointype
- `account` will be a variable index (hardened) depending on which account the user selects
- `change` will either be `0` for change addresses or `1` for receiving addresses (see below)
- `address_index` will be the child key index to generate unique change or receiving address

For instance, when Alice wants to receive d-coins from Bob on her account `0`, she gives Bob her account 0 receiving public key derive from `M/44'/1'/0'/1`. Then Bob uses that key to generate a new child key that will be used as the UTXO address in his transactidon. Since that address must be unique, Bob tries to find an address index, starting from index 0, that has not been used yet. Once he founds one, he uses it in his transaction.

Furthermore, let's assume that Bob wants to send 60 d-coins from a UTXO input of 100. This means that Bobs needs to get 40 d-coins back. For that, he will generate an unused address derived from his parent change address. Assuming that Bob uses his 4th account, the path for the change parent is `M/44'/1'/4'/0`. Like before, bob must find an index, starting from 0, that has not been used to generate his change address.

The CLI tools has the following commands. For each command you can invoke the options `--help` to get all parameters and options. Assuming, the functions in `client.mjs` are correctly implemented, the commands are working as follows:

- Command `create` generates a new wallet. It asks the user for a password, generates a mnemonic phrase and stores it securely in a wallet file `wallet.bin` by default (see command options). The wallet file contains the mnemonic phrase encrypted with the user's password.

  ```
  npm run cli -- create
  ```

- Command `mnemonic` returns the mnemonic phrase extracted from the wallet file:

  ```
  npm run cli -- mnemonic
  ```

- Command `address` returns the receiving public key for the given account. It extracts the mnemonic from the wallet file and computes the receiving address. Here is an example for account 0:

  ```
  npm run cli -- address 0
  ```

- Command `balance` returns the balance for the given account. It will extract two values from the blockchain: the d-coins actually usable (unspent but yet confirmed UTXOs) and the pending ones (unspent but not yet confirmed). Here is an example for account 0:

  ```
  npm run cli -- balance 0
  ```

- Command `transfer` transfers an amount of d-coins from the wallet's given account to a recipient's (receiving) address. Remember, this receiving should not appear in the transaction. Instead the wallet must derive a child address as explained above. Here is an example for transferring 42 d-coins from account 0 to Alice's receiving key.

  ```
  npm run cli -- transfer 0 xpub6FzXSy... 42
  ```

- Command `mine` mines a block that includes a coinbase transaction to reward the given account. Here is an example for account 0:

  ```
  npm run cli -- mine 0
  ```

You can add all kind of options for these commands. For instance you can:

- have a password bypass `--password`
- change the wallet file `--wallet` (default `wallet.bin`)
- change the blockchain node server `--node` (default `https://dotcoin.seclab.space`)
- specify a default config file `--config` (default `config.json`)

### The d-coin Server

The d-coin server ensure that all transactions and blocks given as inputs are valid given the blockchain rules. 
If a block or a transaction is invalid, the `client.mjs` code trow a `ValidationError` exception. This specific exception will be handled as a `400` error by the web server. 
