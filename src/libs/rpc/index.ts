// tslint:disable:no-null-keyword object-literal-sort-keys

import to from 'await-to-js'
import Axios, { AxiosRequestConfig } from 'axios'

import EJError, { EJErrorCode } from '../error'
import { RPC_ERRORS_TRANSLATION } from './constants'
import { JsonRpcRequest, JsonRpcResponse, RpcMethod, RpcMethodParams, RpcMethodResult } from './types'

export interface RpcAuth {
  username: string
  password: string
}

const CONFIG_DEFAULT: AxiosRequestConfig = {
  headers: {
    'Content-Type': 'application/json'
  }
}
// tslint:disable-next-line:no-magic-numbers
const ONE_YEAR_IN_SECONDS: number = 60 * 60 * 24 * 365

/**
 * RPC server related methods matching RPC commands.
 */
export default class Rpc {
  /** Basic Authentication info for RPC calls. */
  private readonly auth: RpcAuth
  /** RPC server URI. */
  private readonly uri: string

  public constructor(uri: string, auth: RpcAuth) {
    this.auth = auth
    this.uri = uri
  }

  /**
   * JSON-RCP query helper.
   */
  private async query<T extends RpcMethod>(method: T, params: RpcMethodParams): Promise<RpcMethodResult<T>> {
    const rpcRequestDataFull: JsonRpcRequest<T> = { jsonrpc: '2.0', method, params }
    const configFull: AxiosRequestConfig = { ...CONFIG_DEFAULT, ...{ auth: this.auth } }

    const [err, res] = await to(Axios.post<JsonRpcResponse<T>>(this.uri, rpcRequestDataFull, configFull))

    if (err !== null) {
      if (
        err.response !== undefined
        && err.response.data !== undefined
        && err.response.data.error !== undefined
        && err.response.data.error !== null
      ) {
        const errorCode: string = String(err.response.data.error.code)
        const errorKey: EJErrorCode | undefined = RPC_ERRORS_TRANSLATION[errorCode]
        if (errorKey !== undefined) {
          throw new EJError(errorKey)
        }

        throw new Error(`libs/rpc: ${err.response.data.error.message}`)
      }

      throw new Error(`libs/rpc: ${typeof err === 'string' ? err : err.message}`)
    }

    if (res === undefined || res.data === undefined) {
      throw new Error(`libs/rpc: We did't get the expected RPC response.`)
    }

    return res.data.result
  }

  /**
   * Change the wallet passphrase from <oldPassphrase> to <newPassphrase>.
   */
  public async changePassphrase(
    oldPassphrase: string,
    newPassphrase: string
  ): Promise<RpcMethodResult<'walletpassphrasechange'>> {
    return this.query('walletpassphrasechange', Array.prototype.slice.call(arguments))
  }

  /**
   * Check the wallet integrity.
   */
  public async check(): Promise<RpcMethodResult<'checkwallet'>> {
    return this.query('checkwallet', null)
  }

  /**
   * Create a raw transaction.
   */
  public async createRawTransaction(
    inputs: Array<{ txid: string, vout: number }>,
    outputs: { [addressHash: string]: number }
  ): Promise<RpcMethodResult<'createrawtransaction'>> {
    return this.query('createrawtransaction', Array.prototype.slice.call(arguments))
  }

  /**
   * Encrypt the wallet with <passphrase>.
   */
  public async encryptWallet(passphrase: string): Promise<RpcMethodResult<'encryptwallet'>> {
    return this.query('encryptwallet', [passphrase])
  }

  /**
   * Get the account associated with the given address.
   */
  public async getAccount(address: string): Promise<RpcMethodResult<'getaccount'>> {
    return this.query('getaccount', [address])
  }

  /**
   * Get the total available balance.
   */
  public async getBalance(account: string = '*', minConfirmations: number = 1): Promise<RpcMethodResult<'getbalance'>> {
    return this.query('getbalance', Array.prototype.slice.call(arguments))
  }

  /**
   * Get best (~ last) block hash.
   */
  public async getBestBlockHash(): Promise<RpcMethodResult<'getbestblockhash'>> {
    return this.query('getbestblockhash', null)
  }

  /**
   * Get block info.
   */
  public async getBlockInfo(hash: string): Promise<RpcMethodResult<'getblock'>> {
    return this.query('getblock', [hash])
  }

  /**
   * Get connection count.
   */
  public async getConnectionCount(): Promise<RpcMethodResult<'getconnectioncount'>> {
    return this.query('getconnectioncount', null)
  }

  /**
   * Get the difficulty as a multiple of the minimum difficulty.
   */
  public async getDifficulty(): Promise<RpcMethodResult<'getdifficulty'>> {
    return this.query('getdifficulty', null)
  }

  /**
   * Get the current state info.
   */
  public async getInfo(): Promise<RpcMethodResult<'getinfo'>> {
    return this.query('getinfo', null)
  }

  /**
   * Get the local block height.
   */
  public async getLocalBlockHeight(): Promise<RpcMethodResult<'getblockcount'>> {
    return this.query('getblockcount', null)
  }

  /**
   * Generate a new address for receiving payments.
   */
  public async getNewAddress(account?: string): Promise<RpcMethodResult<'getnewaddress'>> {
    return this.query('getnewaddress', account !== undefined ? [account] : null)
  }

  /**
   * Get the peers info.
   */
  public async getPeersInfo(): Promise<RpcMethodResult<'getpeerinfo'>> {
    return this.query('getpeerinfo', null)
  }

  /**
   * Get the private key of <addressHash>.
   */
  public async getPrivateKey(addressHash: string): Promise<RpcMethodResult<'dumpprivkey'>> {
    return this.query('dumpprivkey', Array.prototype.slice.call(arguments))
  }

  /**
   * Get the current staking info.
   */
  public async getStakingInfo(): Promise<RpcMethodResult<'getstakinginfo'>> {
    return this.query('getstakinginfo', null)
  }

  /**
   * Get a transaction detailed info.
   */
  public async getTransaction(transactionHash: string): Promise<RpcMethodResult<'gettransaction'>> {
    return this.query('gettransaction', Array.prototype.slice.call(arguments))
  }

  /**
   * Import a new address private key.
   */
  public async importPrivateKey(privateKey: string): Promise<RpcMethodResult<'importprivkey'>> {
    return this.query('importprivkey', Array.prototype.slice.call(arguments))
  }

  /**
   * Lists groups of addresses which have had their common ownership made public
   * by common use as inputs or as the resulting change in past transactions.
   */
  public async listAddressGroupings(): Promise<RpcMethodResult<'listaddressgroupings'>> {
    return this.query('listaddressgroupings', null)
  }

  /**
   * List receiving addresses data.
   */
  public async listReceivedByAddress(
    minConfirmations: number = 1,
    includeEmpty: boolean = false
  ): Promise<RpcMethodResult<'listreceivedbyaddress'>> {
    return this.query('listreceivedbyaddress', Array.prototype.slice.call(arguments))
  }

  /**
   * List transactions.
   */
  public async listTransactions(
    account: string = '*',
    count: number = 10,
    from: number = 0
  ): Promise<RpcMethodResult<'listtransactions'>> {
    return this.query('listtransactions', Array.prototype.slice.call(arguments))
  }

  /**
   * List unspent transactions between <minConfirmations> and <maxConfirmations>,
   * for the given list of <address> if specified.
   */
  public async listUnspent(
    minConfirmations: number = 1,
    maxConfirmations: number = 9999999,
    addresses?: string[]
  ): Promise<RpcMethodResult<'listunspent'>> {
    return this.query('listunspent', Array.prototype.slice.call(arguments))
  }

  /**
   * Removes the wallet encryption key from memory, locking the wallet.
   * After calling this method, you will need to call walletpassphrase again
   * before being able to call any methods which require the wallet to be unlocked.
   */
  public async lock(): Promise<RpcMethodResult<'walletlock'>> {
    return this.query('walletlock', null)
  }

  /**
   * Make a public/private key pair.
   * <prefix> is the optional preferred prefix for the public key.
   */
  public async makeKeyPair(prefix?: string): Promise<RpcMethodResult<'makekeypair'>> {
    return this.query('makekeypair', prefix !== undefined ? [prefix] : null)
  }

  /**
   * Broadcast a raw transaction.
   */
  public async sendRawTransaction(signedTransactionHash: string): Promise<RpcMethodResult<'sendrawtransaction'>> {
    return this.query('sendrawtransaction', Array.prototype.slice.call(arguments))
  }

  /**
   * Sign a message.
   */
  public async signMessage(address: string, message: string): Promise<RpcMethodResult<'signmessage'>> {
    return this.query('signmessage', Array.prototype.slice.call(arguments))
  }

  /**
   * Sign a raw transaction.
   */
  public async signRawTransaction(unsignedTransactionHash: string): Promise<RpcMethodResult<'signrawtransaction'>> {
    return this.query('signrawtransaction', Array.prototype.slice.call(arguments))
  }

  /**
   * Exit the daemon.
   */
  public async stop(): Promise<RpcMethodResult<'stop'>> {
    return this.query('stop', null)
  }

  /**
   * Stores the wallet decryption key in memory for <timeout> seconds.
   * If [stakingOnly] is TRUE, sending functions are disabled.
   */
  public async unlock(
    passphrase: string,
    timeout: number = ONE_YEAR_IN_SECONDS,
    stakingOnly: boolean = true
  ): Promise<RpcMethodResult<'walletpassphrase'>> {
    return this.query('walletpassphrase', [passphrase, timeout, stakingOnly])
  }

  /**
   * Validate <address> and get its info.
   */
  public async validateAddress(address: string): Promise<RpcMethodResult<'validateaddress'>> {
    return this.query('validateaddress', Array.prototype.slice.call(arguments))
  }

  /**
   * Validate <publicKey> and get its info.
   */
  public async validatePublicKey(publicKey: string): Promise<RpcMethodResult<'validatepubkey'>> {
    return this.query('validatepubkey', Array.prototype.slice.call(arguments))
  }

  /**
   * Verify a signed a message.
   */
  public async verifyMessage(
    address: string,
    signature: string,
    message: string,
  ): Promise<RpcMethodResult<'verifymessage'>> {
    return this.query('verifymessage', Array.prototype.slice.call(arguments))
  }
}
