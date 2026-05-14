export function useTockDocsColorMode() {
  const appConfig = useAppConfig()
  const forced = (appConfig.tockdocs as { colorMode?: string })?.colorMode
  return {
    forced: forced === 'light' || forced === 'dark' ? forced : undefined,
  }
}
