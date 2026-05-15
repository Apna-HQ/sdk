import { Transport } from '../core/transport';

export interface BitcoinSendOptions {
  feeRate?: number;
  memo?: string;
}

export interface ApnaBitcoin {
  getAddress(): Promise<string>;
  signMessage(message: string): Promise<string>;
  signPsbt(psbt: string): Promise<string>;
  sendBitcoin(
    address: string,
    amountSats: number,
    opts?: BitcoinSendOptions
  ): Promise<string>;
}

export interface BitcoinProtocolOptions {
  transport: () => Transport;
  isCapabilitySupported?: (capability: string) => boolean;
}

/** Create the low-level Bitcoin protocol module. */
export function createBitcoinProtocol(
  options: BitcoinProtocolOptions
): ApnaBitcoin {
  const call = (capability: string, args: unknown[]): Promise<unknown> =>
    options.isCapabilitySupported?.(capability) === false
      ? Promise.reject(new Error('bitcoin not supported by this host'))
      : options.transport().call(capability, args);

  return {
    getAddress: () => call('bitcoin.getAddress', []) as Promise<string>,
    signMessage: (message: string) =>
      call('bitcoin.signMessage', [message]) as Promise<string>,
    signPsbt: (psbt: string) =>
      call('bitcoin.signPsbt', [psbt]) as Promise<string>,
    sendBitcoin: (
      address: string,
      amountSats: number,
      opts?: BitcoinSendOptions
    ) =>
      call('bitcoin.sendBitcoin', [address, amountSats, opts]) as Promise<string>,
  };
}
