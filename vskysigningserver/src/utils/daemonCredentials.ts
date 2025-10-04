import * as fs from 'fs'
import * as os from 'os'
import path from 'path'

export interface VerusDaemonConfig {
  rpchost: string
  rpcport: string
  rpcuser: string
  rpcpassword: string
}

// TODO: Use `getvdxfid` and the hash160result to find the symbol for PBaaS chains.
const chainNametoSymbol: {[key: string]: string} = {
  VRSC: 'VRSC',
  VRSCTEST: 'vrsctest',
  BETELGEUSE: 'c79ecabcf7c56da37b520d70270d1c19bd136e11',
}

const pbaasTestmodeChains = ['BETELGEUSE']

const isPbaasTestmodeChain = (chainName: string): boolean => {
  return pbaasTestmodeChains.includes(chainName)
}

// Gets the daemon credentials from the configuration file in the Verus data directory,
// which can be specified by `customPath`.
export const fetchVerusDaemonConfig = (
  chainName: string,
  customPath?: string,
): VerusDaemonConfig => {
  if (customPath) {
    return parseConfigFile(customPath)
  }
  const configPath = getConfigPath(chainName)
  return parseConfigFile(configPath!)
}

const getConfigPath = (chainName: string): string => {
  const symbol = chainNametoSymbol[chainName]
  const isPbaasTestmode = isPbaasTestmodeChain(chainName)

  let dir
  switch (process.platform) {
    case 'linux':
      dir = getLinuxDir(symbol, isPbaasTestmode)
      break
    case 'darwin':
      dir = getMacOSDir(symbol, isPbaasTestmode)
      break
    case 'win32':
      dir = getWindowsDir(symbol, isPbaasTestmode)
      break
    default:
      throw new Error('Unknown platform to find the Verus daemon config file.')
  }

  return path.join(dir, symbol + '.conf')
}

const parseConfigFile = (filePath: string): VerusDaemonConfig => {
  const config: VerusDaemonConfig = {
    rpchost: '127.0.0.1',
    rpcport: '18843',
    rpcuser: '',
    rpcpassword: '',
  }

  const file = fs.readFileSync(filePath, 'utf-8')
  const lines = file.split(os.EOL).filter(Boolean)

  const isConfigKey = (key: string): key is keyof VerusDaemonConfig => {
    return key in config
  }

  for (const line of lines) {
    const trimmedLine = line.trim()
    const [key, value] = trimmedLine.split('=')

    if (isConfigKey(key) && value) {
      config[key] = value
    }
  }

  return config
}

const getLinuxDir = (symbol: string, isPbaasTestmode?: boolean): string => {
  const homeDir = os.homedir() ?? '/'

  const komodoDir = path.join(homeDir, '.komodo')

  if (symbol === 'VRSC' || symbol === 'vrsctest') {
    return path.join(komodoDir, symbol)
  }

  // Handle PbaaS chains.
  const pbaasDir = path.join(
    homeDir,
    isPbaasTestmode ? '.verustest' : '.verus',
    'pbaas',
  )
  return path.join(pbaasDir, symbol)
}

const getMacOSDir = (symbol: string, isPbaasTestmode?: boolean): string => {
  const homeDir = os.homedir() ?? '/'

  const appSupport = path.join(homeDir, 'Library', 'Application Support')

  if (symbol === 'VRSC' || symbol === 'vrsctest') {
    return path.join(appSupport, 'Komodo', symbol)
  }

  // Handle PbaaS chains.
  const pbaasDir = path.join(
    appSupport,
    isPbaasTestmode ? 'VerusTest' : 'Verus',
    'pbaas',
  )
  return path.join(pbaasDir, symbol)
}

const getWindowsDir = (symbol: string, isPbaasTestmode?: boolean): string => {
  const appData = process.env.APPDATA ?? ''

  if (symbol === 'VRSC' || symbol === 'vrsctest') {
    return path.join(appData, 'Komodo', symbol)
  }

  // Handle PbaaS chains.
  const pbaasDir = path.join(
    appData,
    isPbaasTestmode ? 'VerusTest' : 'Verus',
    'PBaaS',
  )
  return path.join(pbaasDir, symbol)
}
