import to from 'await-to-js'

import tryCatch from '../helpers/tryCatch'
import Crypto from '../libs/crypto'
import Electra from '../libs/electra'
import Rpc from '../libs/rpc'
import webServices from '../web-services'

import { Settings } from '..'
import { Address } from '../types'
import { WalletAddress, WalletData, WalletStakingInfo, WalletState, WalletTransaction } from './types'

// tslint:disable-next-line:no-magic-numbers
const ONE_YEAR_IN_SECONDS: number = 60 * 60 * 24 * 365
const WALLET_INDEX: number = 0

/**
 * Wallet management.
 */
export default class Wallet {
  /** List of the wallet HD addresses. */
  private ADDRESSES: WalletAddress[] = []
  /** List of the wallet HD addresses. */
  public get addresses(): WalletAddress[] {
    if (this.STATE !== WalletState.READY) {
      throw new Error(`ElectraJs.Wallet: The #addresses are only available when the #state is "READY".`)
    }

    return this.ADDRESSES
  }

  /** List of the wallet non-HD (random) and HD addresses. */
  public get allAddresses(): WalletAddress[] {
    if (this.STATE !== WalletState.READY) {
      throw new Error(`ElectraJs.Wallet: #allAddresses are only available when the #state is "READY".`)
    }

    return [...this.addresses, ...this.randomAddresses]
  }

  /** List of the wallet random (non-HD) addresses. */
  private RANDOM_ADDRESSES: WalletAddress[] = []
  /** List of the wallet random (non-HD) addresses. */
  public get randomAddresses(): WalletAddress[] {
    if (this.STATE !== WalletState.READY) {
      throw new Error(`ElectraJs.Wallet: The #randomAddresses are only available when the #state is "READY".`)
    }

    return this.RANDOM_ADDRESSES
  }

  /**
   * Is this a HD wallet ?
   *
   * @see https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
   */
  public get isHD(): boolean {
    if (this.STATE !== WalletState.READY) {
      throw new Error(`ElectraJs.Wallet: #isHD is only available when the #state is "READY".`)
    }

    return Boolean(this.MASTER_NODE_ADDRESS)
  }

  /** List of the wallet random (non-HD) addresses. */
  private IS_LOCKED: boolean = false
  /**
   * Is this wallet locked ?
   * The wallet is considered as locked when all its addresses private keys are currently ciphered.
   */
  public get isLocked(): boolean {
    if (this.STATE !== WalletState.READY) {
      throw new Error(`ElectraJs.Wallet: #isLocked is only available when the #state is "READY".`)
    }

    return this.IS_LOCKED
  }

  /**
   * Wallet HD Master Node address.
   *
   * @note
   * THIS ADDRESS MUST BE KEPT AN	INACCESSIBLE PRIVATE PROPERTY !
   * While revealing the Master Node address hash would not be a security risk, it still would be privacy risk.
   * Indeed, "guessing" the children addresses from this address hash is really difficult, but NOT impossible.
   *
   * @see https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki#security
   */
  private MASTER_NODE_ADDRESS: WalletAddress | undefined

  /** Mnenonic. */
  private MNEMONIC: string | undefined
  /**
   * Mnenonic.
   *
   * @note
   * ONLY available when generating a brand new Wallet, which happens after calling #generate()
   * with an undefined <mnemonic> parameter on a Wallet instance with an "EMPTY" #state.
   */
  public get mnemonic(): string {
    if (this.STATE !== WalletState.READY) {
      throw new Error(`ElectraJs.Wallet:
        #mnemonic is only available after a brand new Wallet has been generated the #state is "READY".
      `)
    }

    if (this.MNEMONIC === undefined) {
      throw new Error(`ElectraJs.Wallet: #mnemonic is only available after a brand new Wallet has been generated.`)
    }

    return this.MNEMONIC
  }

  /** RPC Server instance.  */
  private readonly rpc: Rpc | undefined

  /** Wallet state. */
  private STATE: WalletState = WalletState.EMPTY
  /**
   * Wallet state.
   * This state can be one of:
   * - EMPTY, when it has just been instanciated or reset ;
   * - READY, when it has been generated, or seeded with random (non-HD) private keys imports.
   */
  public get state(): WalletState {
    return this.STATE
  }

  /** List of the wallet transactions. */
  private TRANSACTIONS: WalletTransaction[] = []
  /** List of the wallet transactions. */
  public get transactions(): WalletTransaction[] {
    if (this.STATE !== WalletState.READY) {
      throw new Error(`ElectraJs.Wallet: The #transactions are only available when the #state is "READY".`)
    }

    return this.TRANSACTIONS
  }

  public constructor(settings: Settings = {}) {
    if (settings.rpcServerUri !== undefined && settings.rpcServerAuth !== undefined) {
      this.rpc = new Rpc(settings.rpcServerUri, settings.rpcServerAuth)
      this.STATE = WalletState.READY
    }
  }

  /**
   * Generate an HD wallet from either the provided mnemonic seed, or a randmly generated one,
   * including ‒ at least ‒ the first derived address.
   *
   * @note In case the <mnemonicExtension> is specified, it MUST be encoded in UTF-8 using NFKD.
   *
   * @see https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki#wordlist
   *
   * TODO Figure out a way to validate provided mnemonics using different specs (words list & entropy strength).
   */
  public generate(mnemonic?: string, mnemonicExtension?: string, chainsCount: number = 1): this {
    if (this.STATE === WalletState.READY) {
      throw new Error(`ElectraJs.Wallet:
        The #generate() method can't be called on an already ready wallet (#state = "READY").
        You need to #reset() it first, then #initialize() it again in order to #generate() a new one.
      `)
    }

    let chainIndex: number

    /*
      ----------------------------------
      STEP 1: MNEMONIC
    */

    if (mnemonic !== undefined) {
      if (!Electra.validateMnemonic(mnemonic)) {
        throw new Error(`ElectraJs.Wallet: #generate() <mnemonic> parameter MUST be a valid mnemonic.`)
      }
    } else {
      try {
        // tslint:disable-next-line:no-parameter-reassignment
        mnemonic = Electra.getRandomMnemonic()
        this.MNEMONIC = mnemonic
      }
      catch (err) { throw err }
    }

    /*
      ----------------------------------
      STEP 2: MASTER NODE
    */

    try {
      const address: Address = Electra.getMasterNodeAddressFromMnemonic(mnemonic, mnemonicExtension)
      this.MASTER_NODE_ADDRESS = {
        ...address,
        label: null
      }
    }
    catch (err) { throw err }

    /*
      ----------------------------------
      STEP 3: CHAINS
    */

    chainIndex = -1
    try {
      while (++chainIndex < chainsCount) {
        const address: Address = Electra.getDerivedChainFromMasterNodePrivateKey(
          this.MASTER_NODE_ADDRESS.privateKey,
          WALLET_INDEX,
          chainIndex
        )

        this.ADDRESSES.push({
          ...address,
          label: null
        })
      }
    }
    catch (err) { throw err }

    this.STATE = WalletState.READY

    return this
  }

  /**
   * Lock the wallet, that is, cipher all the private keys.
   */
  public lock(passphrase: string): void {
    if (this.STATE !== WalletState.READY) {
      throw new Error(`ElectraJs.Wallet: The #lock() method can only be called on a ready wallet (#state = "READY").`)
    }

    if (this.rpc !== undefined) {
      const [err] = tryCatch(this.rpc.lock.bind(this))
      if (err !== null) throw err
      this.IS_LOCKED = true

      return
    }

    try {
      if (this.MASTER_NODE_ADDRESS !== undefined && !this.MASTER_NODE_ADDRESS.isCiphered) {
        this.MASTER_NODE_ADDRESS.privateKey = Crypto.cipherPrivateKey(this.MASTER_NODE_ADDRESS.privateKey, passphrase)
      }

      this.ADDRESSES = this.ADDRESSES.map((address: WalletAddress) => {
        if (!address.isCiphered) {
          address.privateKey = Crypto.cipherPrivateKey(address.privateKey, passphrase)
        }

        return address
      })

      this.RANDOM_ADDRESSES = this.RANDOM_ADDRESSES.map((randomAddress: WalletAddress) => {
        if (!randomAddress.isCiphered) {
          randomAddress.privateKey = Crypto.cipherPrivateKey(randomAddress.privateKey, passphrase)
        }

        return randomAddress
      })
    }
    catch (err) { throw err }

    // Locking the wallet should delete any stored mnemonic
    if (this.MNEMONIC !== undefined) delete this.MNEMONIC

    this.IS_LOCKED = true
  }

  /**
   * Unlock the wallet, that is, decipher all the private keys.
   */
  public unlock(passphrase: string, forStakingOnly: boolean = true): void {
    if (this.STATE !== WalletState.READY) {
      throw new Error(`ElectraJs.Wallet: The #unlock() method can only be called on a ready wallet (#state = "READY").`)
    }

    if (this.rpc !== undefined) {
      const [err] = tryCatch(() => (this.rpc as Rpc).unlock(passphrase, ONE_YEAR_IN_SECONDS, forStakingOnly))
      if (err !== null) throw err
      this.IS_LOCKED = false

      return
    }

    try {
      if (this.MASTER_NODE_ADDRESS !== undefined && this.MASTER_NODE_ADDRESS.isCiphered) {
        this.MASTER_NODE_ADDRESS.privateKey = Crypto.decipherPrivateKey(this.MASTER_NODE_ADDRESS.privateKey, passphrase)
      }

      this.ADDRESSES = this.ADDRESSES.map((address: WalletAddress) => {
        if (address.isCiphered) {
          address.privateKey = Crypto.decipherPrivateKey(address.privateKey, passphrase)
        }

        return address
      })

      this.RANDOM_ADDRESSES = this.RANDOM_ADDRESSES.map((randomAddress: WalletAddress) => {
        if (randomAddress.isCiphered) {
          randomAddress.privateKey = Crypto.decipherPrivateKey(randomAddress.privateKey, passphrase)
        }

        return randomAddress
      })
    }
    catch (err) { throw err }

    this.IS_LOCKED = false
  }

  /**
   * Export wallet data with ciphered private keys, or unciphered if <unsafe> is set to TRUE.
   */
  public export(unsafe: boolean = false): WalletData {
    if (this.STATE !== WalletState.READY) {
      throw new Error(`ElectraJs.Wallet: The #export() method can only be called on a ready wallet (#state = "READY").`)
    }

    if (!this.IS_LOCKED && !unsafe) {
      throw new Error(`ElectraJs.Wallet:
        The wallet is currently unlocked. Exporting it would thus export the private keys in clear.
        Either #lock() it first, or set the <force> parameter to TRUE if you want to export the unlocked version.
      `)
    }

    if (this.IS_LOCKED && unsafe) {
      throw new Error(`ElectraJs.Wallet:
        The wallet is currently locked. You need to #unlock() it first to export its unlocked version.
      `)
    }

    return {
      chainsCount: this.ADDRESSES.length,
      masterNodeAddress: this.MASTER_NODE_ADDRESS !== undefined ? this.MASTER_NODE_ADDRESS : null,
      randomAddresses: this.RANDOM_ADDRESSES
    }
  }

  /**
   * Import a ramdomly generated (legacy) WIF private key into the wallet.
   * If the wallet #state is EMPTY, it will generate the wallet (=> READY).
   * If the wallet #state is READY, it will add the private key to the existing one(s).
   */
  public importRandomAddress(address: WalletAddress, passphrase?: string, isHDMasterNode: boolean = false): this {
    if (isHDMasterNode && this.MASTER_NODE_ADDRESS !== undefined) {
      throw new Error(`ElectraJs.Wallet:
        You can't #importAddress() of a HD Master Node into wallet that already has one.
        Do you want to #reset() it first ?
      `)
    }

    // Decipher the PK is necessary
    if (address.isCiphered) {
      if (passphrase === undefined) {
        throw new Error(`ElectraJs.Wallet:
          You can't #importAddress() with a ciphered private key without specifying the <passphrase>.
        `)
      }

      try {
        address.privateKey = Crypto.decipherPrivateKey(address.privateKey, passphrase)
        address.isCiphered = false
      }
      catch (err) {
        throw err
      }
    }

    // Get the address hash
    try {
      address.hash = Electra.getAddressHashFromPrivateKey(address.privateKey)
    }
    catch (err) {
      throw err
    }

    if (isHDMasterNode) {
      if (this.state === WalletState.READY && this.isHD) {
        throw new Error(`ElectraJs.Wallet:
          You can #import() another Wallet HD Master Node. Only one Master Node can be set.
          Maybe you want to #reset() it before doing that ?
        `)
      }

      address.isHD = true
      this.MASTER_NODE_ADDRESS = address

      return this
    }

    this.RANDOM_ADDRESSES.push(address)

    return this
  }

  /**
   * Reset the current wallet properties and switch the #state to "EMPTY".
   */
  public reset(): Wallet {
    if (this.STATE === WalletState.EMPTY) {
      throw new Error(`ElectraJs.Wallet: You can't #reset() a wallet that is already empty (#state = "EMPTY").`)
    }

    delete this.MASTER_NODE_ADDRESS
    delete this.MNEMONIC

    this.ADDRESSES = []
    this.RANDOM_ADDRESSES = []
    this.STATE = WalletState.EMPTY
    this.TRANSACTIONS = []

    return this
  }

  /**
   * Get the global wallet balance, or the <address> balance if specified.
   */
  public async getBalance(addressHash?: string): Promise<number> {
    if (this.STATE === WalletState.EMPTY) {
      throw new Error(`ElectraJs.Wallet: You can't #getBalance() from an empty wallet (#state = "EMPTY").`)
    }

    const addresses: WalletAddress[] = this.allAddresses

    if (addressHash !== undefined) {
      if (addresses.filter((address: WalletAddress) => address.hash === addressHash).length === 0) {
        throw new Error(`ElectraJs.Wallet: You can't #getBalance() with an address not part of the current wallet.`)
      }

      // tslint:disable-next-line:no-shadowed-variable
      const [err, balance] = await to(webServices.getBalanceFor(addressHash))
      if (err !== null) throw err

      return balance as number
    }

    let index: number = addresses.length
    let balanceTotal: number = 0
    while (--index >= 0) {
      const [err, balance] = await to(webServices.getBalanceFor(this.allAddresses[index].hash))
      if (err !== null || balance === undefined) throw err
      balanceTotal += balance
    }

    return balanceTotal
  }

  /**
   * Get the current staking calculated data.
   */
  public async getStakingInfo(): Promise<WalletStakingInfo> {
    const [err, res] = await to((this.rpc as Rpc).getStakingInfo())
    if (err !== null || res === undefined) throw err

    return {
      networkWeight: res.netstakeweight,
      nextRewardIn: res.expectedtime,
      weight: res.weight
    }
  }
}