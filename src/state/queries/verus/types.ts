export interface rpcResult {
  result: unknown
  error?: string
  id: string
  jsonrpc: string
}

export type VerusDaemonApiContext = {
  callDaemon: (
    command: string,
    params?: (string | object)[],
  ) => Promise<rpcResult>
}
