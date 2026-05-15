function loadPlaywright() {
  for (const packageName of ['playwright', 'playwright-core']) {
    try {
      require.resolve(packageName)
      return require(packageName)
    }
    catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') {
        throw error
      }
    }
  }

  throw new Error('Install `playwright` or `playwright-core` before running this script.')
}

module.exports = loadPlaywright()
