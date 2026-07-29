export const QC_CONFIG = {
  maxComponentLines: 400,
  maxFileLines: 600,
  maxCyclomaticComplexity: 10,
  maxFunctionParams: 5,
  maxTsWarnings: 10000,
  allowedConsoleMethods: ['error', 'warn'],
  bundleSizeLimitKB: 500,
  lintExitOnError: true,
  a11yRequiredProps: ['aria-label', 'role', 'aria-modal'],
  securityPatterns: {
    sqlInjection: /(\bSELECT\b.*\bFROM\b|\bINSERT\b.*\bINTO\b|\bDROP\b.*\bTABLE\b|\bDELETE\b.*\bFROM\b)/i,
    massAssignment: /\.(update|create|save|upsert)\(.*req\.(body|params|query)/i,
    hardcodedSecrets: /(?:api[_-]?key|secret|password|token|credential)\s*[:=]\s*['"][^'"]+['"]/i,
  },
  performance: {
    maxUseEffectDeps: 5,
    maxNestedTernary: 2,
    noInlineStyles: false,
    warnLargeImages: true,
  },
}
