#!/usr/bin/env node

/**
 * This script reads the current package.json and uses the main branch's yarn.lock
 * to resolve ^ and ~ versions to their fixed versions.
 *
 * Usage: node scripts/fix-versions-from-lockfile.js [--dry-run] [--output=json|package]
 *
 * Options:
 *   --dry-run    Print changes without modifying package.json
 *   --output     Output format: 'json' for JSON output, 'package' to update package.json (default: json)
 */

const fs = require('fs')
const path = require('path')
const {execSync} = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..')
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json')

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const outputArg = args.find(a => a.startsWith('--output='))
const outputFormat = outputArg ? outputArg.split('=')[1] : 'json'

/**
 * Get yarn.lock content from main branch
 */
function getMainBranchYarnLock() {
  try {
    const lockContent = execSync('git show main:yarn.lock', {
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large lockfiles
    })
    return lockContent
  } catch (error) {
    console.error('Error fetching yarn.lock from main branch:', error.message)
    process.exit(1)
  }
}

/**
 * Parse yarn.lock v1 format to extract package versions
 * Returns a Map of package name -> Map of version range -> resolved version
 */
function parseYarnLock(lockContent) {
  const packages = new Map()
  const lines = lockContent.split('\n')

  let currentPackages = []
  let currentVersion = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip comments and empty lines
    if (line.startsWith('#') || line.trim() === '') {
      continue
    }

    // Package header line (not indented, ends with :)
    if (!line.startsWith(' ') && line.endsWith(':')) {
      // Parse package names from header
      // Format: "package@version", "package@version":
      // Or: "package@version", "package@version", "package@version":
      const header = line.slice(0, -1) // Remove trailing :

      currentPackages = []
      // Split by ", " and parse each entry
      const entries = header.split(', ')
      for (const entry of entries) {
        // Remove quotes if present
        const cleaned = entry.replace(/^"|"$/g, '')
        // Parse package@version
        const atIndex = cleaned.lastIndexOf('@')
        if (atIndex > 0) {
          const pkgName = cleaned.substring(0, atIndex)
          const versionRange = cleaned.substring(atIndex + 1)
          currentPackages.push({name: pkgName, range: versionRange})
        }
      }
      currentVersion = null
      continue
    }

    // Version line (indented)
    if (line.startsWith('  version ')) {
      currentVersion = line.replace('  version ', '').replace(/"/g, '').trim()

      // Store the resolved version for each package/range combination
      for (const pkg of currentPackages) {
        if (!packages.has(pkg.name)) {
          packages.set(pkg.name, new Map())
        }
        packages.get(pkg.name).set(pkg.range, currentVersion)
      }
    }
  }

  return packages
}

/**
 * Extract the base version from a semver range (removes ^ or ~)
 */
function extractBaseVersion(versionRange) {
  return versionRange.replace(/^[\^~]/, '')
}

/**
 * Check if a version matches a semver range (simplified)
 * For ^X.Y.Z: matches X.Y.Z and any version with same major (if major >= 1) or same major.minor (if major = 0)
 * For ~X.Y.Z: matches X.Y.Z and any version with same major.minor
 */
function versionSatisfiesRange(version, range) {
  const prefix = range.charAt(0)
  const baseVersion = extractBaseVersion(range)

  // Handle pre-release versions
  const parseVersion = v => {
    const match = v.match(
      /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?(?:\+.*)?$/,
    )
    if (!match) return null
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4] || null,
    }
  }

  const baseParsed = parseVersion(baseVersion)
  const versionParsed = parseVersion(version)

  if (!baseParsed || !versionParsed) {
    // Fallback: check if version starts with base version's major.minor
    const baseParts = baseVersion.split('.')
    const versionParts = version.split('.')
    return versionParts[0] === baseParts[0] && versionParts[1] === baseParts[1]
  }

  if (prefix === '^') {
    // ^X.Y.Z matches versions with same major (for major >= 1)
    if (baseParsed.major >= 1) {
      return versionParsed.major === baseParsed.major
    }
    // For 0.Y.Z, matches same 0.Y
    return versionParsed.major === 0 && versionParsed.minor === baseParsed.minor
  }

  if (prefix === '~') {
    // ~X.Y.Z matches same major.minor
    return (
      versionParsed.major === baseParsed.major &&
      versionParsed.minor === baseParsed.minor
    )
  }

  // Exact match required
  return version === range
}

/**
 * Find the resolved version for a package with a given range
 */
function findResolvedVersion(packages, pkgName, versionRange) {
  const pkgVersions = packages.get(pkgName)
  if (!pkgVersions) {
    return null
  }

  // First, try exact range match
  if (pkgVersions.has(versionRange)) {
    return pkgVersions.get(versionRange)
  }

  // Try to find a version that satisfies our range
  const baseVersion = extractBaseVersion(versionRange)

  // Look through all resolved versions and find one that matches our range
  for (const [_range, resolvedVersion] of pkgVersions) {
    if (versionSatisfiesRange(resolvedVersion, versionRange)) {
      return resolvedVersion
    }
  }

  // Last resort: find any version that starts with the same major.minor as our base
  const baseParts = baseVersion.split('.')
  for (const [_range2, resolvedVersion] of pkgVersions) {
    const resolvedParts = resolvedVersion.split('.')
    if (
      resolvedParts[0] === baseParts[0] &&
      resolvedParts[1] === baseParts[1]
    ) {
      return resolvedVersion
    }
  }

  return null
}

/**
 * Process dependencies object and find fixed versions
 */
function processDepencies(deps, packages, changes) {
  if (!deps) return {}

  const result = {}

  for (const [pkgName, versionRange] of Object.entries(deps)) {
    // Skip non-semver versions (git URLs, etc.)
    if (
      versionRange.includes('/') ||
      versionRange.includes(':') ||
      versionRange.startsWith('git') ||
      versionRange.startsWith('link:')
    ) {
      result[pkgName] = versionRange
      continue
    }

    // Only process ^ and ~ versions
    if (!versionRange.startsWith('^') && !versionRange.startsWith('~')) {
      result[pkgName] = versionRange
      continue
    }

    const resolvedVersion = findResolvedVersion(packages, pkgName, versionRange)

    if (resolvedVersion) {
      result[pkgName] = resolvedVersion
      changes.push({
        package: pkgName,
        from: versionRange,
        to: resolvedVersion,
      })
    } else {
      // Keep original if we can't find a resolved version
      result[pkgName] = versionRange
      console.warn(
        `Warning: Could not find resolved version for ${pkgName}@${versionRange}`,
      )
    }
  }

  return result
}

function main() {
  console.log('Reading package.json...')
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8'))

  console.log('Fetching yarn.lock from main branch...')
  const lockContent = getMainBranchYarnLock()

  console.log('Parsing yarn.lock...')
  const packages = parseYarnLock(lockContent)

  console.log(`Found ${packages.size} packages in yarn.lock`)

  const changes = []

  // Process dependencies
  const fixedDependencies = processDepencies(
    packageJson.dependencies,
    packages,
    changes,
  )
  const fixedDevDependencies = processDepencies(
    packageJson.devDependencies,
    packages,
    changes,
  )

  console.log(`\nFound ${changes.length} dependencies to fix:\n`)

  // Output changes
  for (const change of changes) {
    console.log(`  ${change.package}: ${change.from} -> ${change.to}`)
  }

  if (outputFormat === 'package' && !dryRun) {
    // Update package.json
    packageJson.dependencies = fixedDependencies
    packageJson.devDependencies = fixedDevDependencies
    fs.writeFileSync(
      PACKAGE_JSON_PATH,
      JSON.stringify(packageJson, null, 2) + '\n',
    )
    console.log('\nUpdated package.json')
  } else if (outputFormat === 'json') {
    console.log('\n--- JSON Output ---')
    console.log(JSON.stringify(changes, null, 2))
  }

  if (dryRun) {
    console.log('\n(Dry run - no changes made)')
  }
}

main()
