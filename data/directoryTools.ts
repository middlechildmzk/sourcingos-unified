import { tools, type Tool } from '@/data/tools'

export type DirectoryTool = Omit<Tool, 'category' | 'bestFor' | 'cost'> & {
  category: string
  bestFor: string
  pricingModel: string
  pricingVerifiedOn: string | null
  reviewNote: string
}

const sourceVerifiedPricing: Record<string, { pricingModel: string; verifiedOn: string }> = {
  'cisa-kev': { pricingModel: 'Free', verifiedOn: '2026-08-19' },
  'nvd': { pricingModel: 'Free', verifiedOn: '2026-08-19' },
}

export function normalizeDirectoryTool(tool: Tool): DirectoryTool {
  const verifiedPricing = sourceVerifiedPricing[tool.id]
  const category = tool.id === 'linkedin-recruiter'
    ? 'Licensed Talent Platform'
    : (tool.id === 'cisa-kev' || tool.id === 'nvd')
      ? 'Research Context'
      : tool.category

  const bestFor = tool.id === 'clearancejobs'
    ? 'Cleared talent marketplace. Platform-level screening may support discovery; SourcingOS treats clearance signals as unverified until recruiter-confirmed through the proper process.'
    : tool.bestFor

  const pricingModel = verifiedPricing?.pricingModel
    ?? (tool.cost === 'Free' ? 'Free' : 'Verify current vendor pricing')

  return {
    ...tool,
    category,
    bestFor,
    pricingModel,
    pricingVerifiedOn: verifiedPricing?.verifiedOn ?? null,
    reviewNote: verifiedPricing
      ? `Pricing/source access verified ${verifiedPricing.verifiedOn}`
      : tool.cost === 'Free'
        ? 'Free-access label inherited from the existing directory record; source re-review pending.'
        : 'Pricing not independently re-verified in the August 19 trust pass. Confirm with vendor before purchase.',
  }
}

export const directoryTools: DirectoryTool[] = tools.map(normalizeDirectoryTool)
