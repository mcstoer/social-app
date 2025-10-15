const os = require('os')
const path = require('path')
const fs = require('fs')
const ini = require('ini')

const APP_NAME = 'verussky'
const DESKTOP_DIR_NAME = 'VerusSky'
const DESKTOP_DIR__NAME_LINUX = `.${APP_NAME}`
const JSON_OUTPUT_FILE = '../src/env/verussky.config.json'

const nameTranslations = {
  is_mainnet: 'isMainnet',
  chain: 'chain',
  default_login_verusid: 'defaultLoginVerusid',
  server_description: 'serverDescription',
  availableuserdomains: 'availableUserDomains',
  did: 'did',
}

const configPath = () => {
  let dir
  switch (process.platform) {
    case 'linux':
      dir = linuxDir()
      break
    case 'darwin':
      dir = macOSDir()
      break
    case 'win32':
      dir = windowsDir()
      break
    default:
      throw new Error('Unknown platform to find the VerusSky config file.')
  }

  return path.join(dir, APP_NAME + '.conf')
}

const linuxDir = () => {
  const homeDir = os.homedir() ?? '/'
  return path.join(homeDir, DESKTOP_DIR__NAME_LINUX)
}

const macOSDir = () => {
  const homeDir = os.homedir() ?? '/'
  return path.join(homeDir, 'Library', 'Application Support', DESKTOP_DIR_NAME)
}

const windowsDir = () => {
  const appData = process.env.APPDATA
  if (appData) {
    return path.join(appData, DESKTOP_DIR_NAME)
  }

  const homeDir = os.homedir() ?? ''
  return path.join(homeDir, 'AppData', 'Roaming', DESKTOP_DIR_NAME)
}

// Check if the config file exists and create one with default values if it doesn't
const ensureConfigFile = () => {
  const configFilePath = configPath()
  const configDir = path.dirname(configFilePath)

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, {recursive: true})
  }

  if (!fs.existsSync(configFilePath)) {
    const defaultConfig = {
      is_mainnet: false,
      chain: 'VRSCTEST',
      default_login_verusid: true,
      server_description: {
        'availableuserdomains[]': '.verus.io',
        did: 'did:verus:iJhCezBExJHvtyH3fGhNnt2NhU4Ztkf2yq',
      },
    }
    const configContent = ini.stringify(defaultConfig)
    fs.writeFileSync(configFilePath, configContent, 'utf8')
  }

  return configFilePath
}

const readConfig = () => {
  const configFilePath = ensureConfigFile()
  const configContent = fs.readFileSync(configFilePath, 'utf8')
  return ini.parse(configContent)
}

const translateConfigVariableNames = config => {
  const translated = {}

  for (const [key, value] of Object.entries(config)) {
    const translatedKey = nameTranslations[key] || key

    // Handle nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      translated[translatedKey] = translateConfigVariableNames(value)
    } else {
      translated[translatedKey] = value
    }
  }

  return translated
}

const writeJSONConfig = config => {
  const outputPath = path.join(__dirname, JSON_OUTPUT_FILE)

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(path.dirname(outputPath), {recursive: true})
  }

  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

const config = readConfig()
const normalizedConfig = translateConfigVariableNames(config)

writeJSONConfig(normalizedConfig)

console.log(`VerusSky config written to ${JSON_OUTPUT_FILE}`)
