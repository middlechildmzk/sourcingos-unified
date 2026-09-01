export type ExplicitExperienceRequirement = {
  years: number
  plus: boolean
  capability: string
  phrase: string
}

function displayCapability(value: string): string {
  return value
    .replace(/\brhel\b/gi, 'RHEL')
    .replace(/\bred\s+hat\b/gi, 'Red Hat')
    .replace(/\blinux\b/gi, 'Linux')
    .replace(/\bunix\b/gi, 'Unix')
    .replace(/\baws\b/gi, 'AWS')
    .replace(/\bgcp\b/gi, 'GCP')
    .replace(/\bkubernetes\b/gi, 'Kubernetes')
    .replace(/\bterraform\b/gi, 'Terraform')
    .replace(/\bpython\b/gi, 'Python')
}

function cleanCapability(value: string): string {
  return displayCapability(value
    .replace(/\b(?:experience|expertise|background)\b\s*$/i, '')
    .replace(/^[\s,;:-]+|[\s,;:.-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80))
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function stopCapability(value: string): boolean {
  const candidate = normalized(value)
  return !candidate || /^(?:experience|work|professional|relevant|overall|industry|total)$/.test(candidate)
}

/** Extract only quantified experience explicitly stated by the recruiter. */
export function extractExplicitExperienceRequirements(rawText: string): ExplicitExperienceRequirement[] {
  const compact = rawText.replace(/\s+/g, ' ').trim()
  const found: ExplicitExperienceRequirement[] = []
  const patterns = [
    /\b(\d{1,2})\s*(\+)?\s*(?:years?|yrs?)\s+(?:of\s+)?([a-z][a-z0-9+#./& -]{1,70}?)(?=\s+(?:and|plus|with|who|that|in|near|around|based|but)\b|[,;.]|$)/gi,
    /\b(?:at\s+least|minimum\s+of)\s+(\d{1,2})\s*(?:years?|yrs?)\s+(?:of\s+)?([a-z][a-z0-9+#./& -]{1,70}?)(?=\s+(?:and|plus|with|who|that|in|near|around|based|but)\b|[,;.]|$)/gi,
    /\b(\d{1,2})\s*(?:years?|yrs?)\s+(?:or\s+more)\s+(?:of\s+)?([a-z][a-z0-9+#./& -]{1,70}?)(?=\s+(?:and|plus|with|who|that|in|near|around|based|but)\b|[,;.]|$)/gi,
  ]

  for (const [index, pattern] of patterns.entries()) {
    for (const match of compact.matchAll(pattern)) {
      const years = Number(match[1])
      const plus = index === 0 ? Boolean(match[2]) : true
      const rawCapability = index === 0 ? match[3] : match[2]
      const capability = cleanCapability(rawCapability || '')
      if (!Number.isInteger(years) || years < 1 || years > 50 || stopCapability(capability)) continue
      const phrase = `${years}${plus ? '+' : ''} years ${capability} experience`
      if (!found.some(item => normalized(item.phrase) === normalized(phrase))) {
        found.push({ years, plus, capability, phrase })
      }
    }
  }

  return found.slice(0, 6)
}

/**
 * Explicit recruiter-stated experience survives model/parser misses. If a model
 * returned only the bare capability (e.g. "Linux"), replace that weaker duplicate
 * with the recruiter's quantified requirement rather than showing both.
 */
export function mergeExplicitExperienceRequirements(existing: string[], rawText: string, max = 16): string[] {
  const explicit = extractExplicitExperienceRequirements(rawText)
  if (!explicit.length) return Array.from(new Set(existing.map(value => value.trim()).filter(Boolean))).slice(0, max)

  let merged = existing.map(value => value.trim()).filter(Boolean)
  for (const requirement of explicit) {
    const capability = normalized(requirement.capability)
    merged = merged.filter(value => {
      const current = normalized(value)
      if (!current) return false
      if (current === capability) return false
      if (current === `${capability} experience`) return false
      return true
    })
    merged.unshift(requirement.phrase)
  }
  return Array.from(new Set(merged)).slice(0, max)
}
