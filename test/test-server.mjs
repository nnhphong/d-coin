import { rmSync } from "fs";
import chai from "chai";

import { ClientError, DotcoinClient } from "../core/client.mjs";
import { DotcoinServer } from "../core/server.mjs";

const expect = chai.expect;

const databasePath = "data/testDb";

describe("Testing Server features", function () {
  this.timeout(10000);
  const config = {
    difficulty: 1,
    amount: 100,
    limit: 1024,
  };
  let client1;
  let client2;
  let server;
  let client;

  before(async function () {
    client1 = new DotcoinClient({ ...config, path: databasePath });
    client2 = new DotcoinClient({ ...config, path: databasePath });    
    server = new DotcoinServer({
      ...config,
      path: databasePath,
    });
  });

  after(function () {
    server.destroy();
  });

  it("it should create the genesis block", async function () {
    const { block, coinbase, transactions } = await client1.mine(0);
    const blockMined = await server.addBlock(block, coinbase, transactions);
});

it("it should return the balances", async function () {
  const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
  expect(usable1).to.be.equal(100);
  expect(pending1).to.be.equal(0);
  const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
  expect(usable2).to.be.equal(0);
  expect(pending2).to.be.equal(0);
});

  it("server should not accept this transaction", async function () {
    let txParams = {
        utxoIns: [],
        utxoOuts: [],
    }
    try {
        await server.addTransaction(txParams)
    }
    catch (e) {
        console.log(e.message);
    }
  });

  it("server should not accept this transaction", async function () {
    const txParams = await client1.createTransaction(
        0,
        await client2.getReceivingAddress(0),
        10,
    );

    txParams.utxoOuts[0].address = 'xpub6G1JT8repj3iAxJxDX4KWzQeHudxcxvFwqWjxDpSpK8jVMhFBYk9FHm7YARuu7me7VDhszi5fBTr4HHnxVfB8R4ybUhETPArHZcwd9S4gu'
    
    try {
        await server.verifyTransaction(txParams)
    }
    catch (e) {
        console.log(e.message);
    }
  });

  it("the balances should remain unchanged", async function () {
    const { usable: usable1, pending: pending1 } = await client1.getBalance(0);
    expect(usable1).to.be.equal(100);
    expect(pending1).to.be.equal(0);
    const { usable: usable2, pending: pending2 } = await client2.getBalance(0);
    expect(usable2).to.be.equal(0);
    expect(pending2).to.be.equal(0);
  });
  

  it("server should not accept this transaction", async function () {
    const txParams = await client1.createTransaction(
        0,
        await client2.getReceivingAddress(0),
        10,
    );

    txParams._id = '2XHM71NEBpseofrZ5cqBfFXvvsQWRoKaapRub8Gv84w6REVmrJ'
    
    try {
        await server.verifyTransaction(txParams)
    }
    catch (e) {
        console.log(e.message);
    }
  });

  it("server should not accept this transaction", async function () {
    const txParams = await client1.createTransaction(
        0,
        await client2.getReceivingAddress(0),
        10,
    );

    txParams.utxoIns = []
    
    try {
        await server.verifyTransaction(txParams)
    }
    catch (e) {
        console.log(e.message);
    }
  });

  it("server should not accept this transaction", async function() {
    try {
        const txParams = await client1.createTransaction(
            0,
            await client2.getReceivingAddress(0),
            110,
        );
        await server.verifyTransaction(txParams)
    }
    catch (e) {
        console.log(e.message);
    }
  })

  it("Now, server should accept the first transaction and rejects the second one", async function() {
    const txParams = await client1.createTransaction(
        0,
        await client2.getReceivingAddress(0),
        10,
    );
    await server.addTransaction(txParams)
    
    try {
        await server.addTransaction(txParams)
    } catch (e) {
        console.log(e.message);
    }
  })
});