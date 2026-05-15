import { Transport } from '../core/transport';

export interface EthereumTransactionRequest {
  to?: string;
  from?: string;
  value?: string;
  data?: string;
  chainId?: string | number;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: string;
}

export interface ApnaEthereum {
  request<T = unknown>(method: string, params?: unknown[]): Promise<T>;
  getAddress(): Promise<string>;
  signMessage(message: string): Promise<string>;
  signTypedData(data: unknown): Promise<string>;
  sendTransaction(tx: EthereumTransactionRequest): Promise<string>;
}

export interface EthereumProtocolOptions {
  transport: () => Transport;
  isCapabilitySupported?: (capability: string) => boolean;
}

/** Create the low-level Ethereum protocol module. */
export function createEthereumProtocol(
  options: EthereumProtocolOptions
): ApnaEthereum {
  const call = (capability: string, args: unknown[]): Promise<unknown> =>
    options.isCapabilitySupported?.(capability) === false
      ? Promise.reject(new Error('ethereum not supported by this host'))
      : options.transport().call(capability, args);

  return {
    request: <T = unknown>(method: string, params: unknown[] = []) =>
      call('ethereum.request', [method, params]) as Promise<T>,
    getAddress: () => call('ethereum.getAddress', []) as Promise<string>,
    signMessage: (message: string) =>
      call('ethereum.signMessage', [message]) as Promise<string>,
    signTypedData: (data: unknown) =>
      call('ethereum.signTypedData', [data]) as Promise<string>,
    sendTransaction: (tx: EthereumTransactionRequest) =>
      call('ethereum.sendTransaction', [tx]) as Promise<string>,
  };
}
