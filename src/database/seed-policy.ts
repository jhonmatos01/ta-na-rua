export function assertDevelopmentSeedAllowed(nodeEnv: string): void {
  if (nodeEnv === 'production') {
    throw new Error('O seed de desenvolvimento nao pode ser executado em producao.');
  }
}
