var log = require('minilog')('sender');
require('minilog').enable();

const GAS = 4000000;

export class Sender {
  constructor(contract, web3) {
    this.contract = contract;
    this.web3 = web3;
  }

  send(name, args, eventOptions, block) {
    const that = this;
    const executor = (resolve, reject) => {
      const tx = that.contract[name].sendTransaction(...args, {gas: GAS}, (err, tx) => {
        if (!err) {
          log.info(name + ' transaction was sent. HASH: ' + tx);
          if (!that.web3.eth.getTransaction(tx)) {
            log.warn(tx + " transaction was lost! Resending...");
            return executor(resolve, reject);          
          }
          that.watch(eventOptions, block)(tx, resolve, reject);
        } else {
          reject(err + ' at transaction \'' + name + '\' with args: ' + args);
        }
      });
    };
    return new Promise((resolve, reject) => executor(resolve, reject));
  }

  watch(options, block) {
    let listener  = null;
    let predicate = null;
    if (options.event) {
      listener = this.contract[options.event];
      listener = listener.call({fromBlock:'latest', toBlock:'pending'});
      predicate = (tx, logs) => logs.transactionHash == tx;
    } else if (options.filter) {
      listener = this.web3.eth.filter('latest');
      predicate = (tx, logs) => this.wasTransactionIncluded(logs, tx);
    } else 
      return Promise.reject('Wrong filter/event, was: ' + options.filter);

    return (tx, resolve, reject) => {
      listener.watch((err, logs) => {
        if (err) {
          reject(err + 'when watching tx: ' + tx);
          return;
        }
        if (predicate(tx, logs)) {
          listener.stopWatching();
          const yielded = block(logs);
          resolve(yielded);
        }
      });        
    }
  }

  wasTransactionIncluded(blockHash, tx) {
    return this.web3.eth.getBlock(blockHash).transactions.includes(tx);
  }

}
