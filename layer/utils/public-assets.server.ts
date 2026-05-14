export async function getPublicAssetCandidates(assetPath: string, cwd = process.cwd()) {
  const { join } = await import('node:path')
  const normalizedPath = assetPath.replace(/^\//, '')

  return [
    join(cwd, 'public', normalizedPath),
    join(cwd, 'docs', 'public', normalizedPath),
    join(cwd, 'playground', 'public', normalizedPath),
    join(cwd, 'layer', 'app', 'public', normalizedPath),
  ]
}

export async function findExistingPublicAsset(assetPath: string, cwd = process.cwd()) {
  const [{ existsSync }, candidates] = await Promise.all([
    import('node:fs'),
    getPublicAssetCandidates(assetPath, cwd),
  ])

  return candidates.find(candidate => existsSync(candidate)) || null
}
