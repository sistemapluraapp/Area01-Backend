export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '')
}

export function isValidCpf(cpf: string): boolean {
  const digits = normalizeCpf(cpf)
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false

  const checkDigit = (base: string): number => {
    let sum = 0
    let weight = base.length + 1
    for (const char of base) {
      sum += Number(char) * weight
      weight -= 1
    }
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const base = digits.slice(0, 9)
  const d1 = checkDigit(base)
  const d2 = checkDigit(base + d1)
  return digits === base + String(d1) + String(d2)
}
