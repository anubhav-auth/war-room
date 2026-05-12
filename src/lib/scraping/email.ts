export function generateEmailPermutations(fullName: string, domain: string): string[] {
  const cleanName = fullName.trim().toLowerCase()
  const parts = cleanName.split(/\s+/)
  
  if (parts.length < 1) return []
  
  const first = parts[0]
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  const f = first[0]
  const l = last ? last[0] : ''
  
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  
  const permutations = new Set<string>()
  
  if (first) permutations.add(`${first}@${cleanDomain}`)
  if (first && last) {
    permutations.add(`${first}.${last}@${cleanDomain}`)
    permutations.add(`${first}${last}@${cleanDomain}`)
    permutations.add(`${f}${last}@${cleanDomain}`)
    permutations.add(`${first}${l}@${cleanDomain}`)
    permutations.add(`${first}_${last}@${cleanDomain}`)
  }
  if (last) permutations.add(`${last}@${cleanDomain}`)
  
  return Array.from(permutations)
}
