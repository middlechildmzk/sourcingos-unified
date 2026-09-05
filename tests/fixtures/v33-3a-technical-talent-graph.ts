/**
 * Deterministic fixtures for the V33.3A Technical Talent Graph regression
 * gates. No network. Every payload mirrors the shape of the official API
 * response the connector reads.
 */

import type {
  GitHubDossierInput,
  GitHubRepositoryPayload,
} from '../../lib/connectors/github-v2'
import type { StackDossierInput } from '../../lib/connectors/stackoverflow-v2'

export const OBSERVED_AT = '2026-08-31T12:00:00.000Z'

function repo(overrides: Partial<GitHubRepositoryPayload>): GitHubRepositoryPayload {
  return {
    id: 1,
    name: 'repo',
    full_name: 'owner/repo',
    html_url: 'https://github.com/owner/repo',
    description: 'A public repository with a real description that is long enough to count.',
    fork: false,
    archived: false,
    topics: [],
    language: null,
    stargazers_count: 12,
    forks_count: 3,
    created_at: '2023-01-04T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    pushed_at: '2026-06-01T00:00:00Z',
    owner: { login: 'owner' },
    ...overrides,
  }
}

/** Case A: Jane Smith on GitHub. Personal domain jane.dev, Chicago. */
export const caseAGitHub: GitHubDossierInput = {
  user: {
    login: 'janesmith',
    type: 'User',
    name: 'Jane Smith',
    bio: 'Platform engineer.',
    company: '@northwind',
    location: 'Chicago, IL',
    blog: 'https://jane.dev',
    email: null,
    html_url: 'https://github.com/janesmith',
    avatar_url: 'https://avatars.githubusercontent.com/u/1',
    created_at: '2016-02-01T00:00:00Z',
  },
  repositories: [
    repo({
      id: 11,
      name: 'helm-operator',
      full_name: 'janesmith/helm-operator',
      html_url: 'https://github.com/janesmith/helm-operator',
      description: 'A Kubernetes operator packaged with Helm for internal platform teams.',
      topics: ['kubernetes', 'helm', 'operator'],
      language: 'Go',
      stargazers_count: 240,
      owner: { login: 'janesmith' },
    }),
    repo({
      id: 12,
      name: 'tf-modules',
      full_name: 'janesmith/tf-modules',
      html_url: 'https://github.com/janesmith/tf-modules',
      description: 'Reusable Terraform modules for multi-account networking.',
      topics: ['terraform'],
      language: 'HCL',
      stargazers_count: 45,
      owner: { login: 'janesmith' },
    }),
  ],
  contributions: {
    contributionYears: [2024, 2025, 2026],
    totalCommitContributions: 812,
    totalPullRequestContributions: 96,
    totalPullRequestReviewContributions: 141,
    totalIssueContributions: 40,
    commitContributionsByRepository: [
      { repository: { nameWithOwner: 'kubernetes/kubernetes', url: 'https://github.com/kubernetes/kubernetes', isPrivate: false }, contributions: { totalCount: 38 } },
      { repository: { nameWithOwner: 'someorg/tiny', url: 'https://github.com/someorg/tiny', isPrivate: false }, contributions: { totalCount: 2 } },
    ],
    pullRequestReviewContributionsByRepository: [
      { repository: { nameWithOwner: 'kubernetes/kubernetes', url: 'https://github.com/kubernetes/kubernetes', isPrivate: false }, contributions: { totalCount: 22 } },
    ],
  },
  socialAccounts: [],
  observedAt: OBSERVED_AT,
}

/** Case A: the same person on Stack Overflow. Same personal domain. */
export const caseAStackOverflow: StackDossierInput = {
  user: {
    user_id: 99001,
    display_name: 'Jane Smith',
    reputation: 41230,
    location: 'Chicago, IL',
    website_url: 'https://jane.dev/about',
    link: 'https://stackoverflow.com/users/99001/jane-smith',
    creation_date: 1400000000,
    last_access_date: 1780000000,
    user_type: 'registered',
  },
  tagStats: [
    { tag: 'kubernetes', window: 'all_time', postCount: 18, score: 412 },
    { tag: 'terraform', window: 'all_time', postCount: 9, score: 121 },
  ],
  topAnswerTags: [
    { tag: 'kubernetes', answerCount: 18, answerScore: 412 },
    { tag: 'terraform', answerCount: 9, answerScore: 121 },
  ],
  observedAt: OBSERVED_AT,
}

/** Case B: common-name collision. Different cities, different domains. */
export const caseBGitHub: GitHubDossierInput = {
  user: {
    login: 'alexkim',
    type: 'User',
    name: 'Alex Kim',
    company: 'Cloudscale',
    location: 'Seattle, WA',
    blog: 'https://alexcloud.dev',
    html_url: 'https://github.com/alexkim',
    created_at: '2018-05-01T00:00:00Z',
  },
  repositories: [
    repo({
      id: 21,
      name: 'k8s-cost',
      full_name: 'alexkim/k8s-cost',
      html_url: 'https://github.com/alexkim/k8s-cost',
      description: 'Cost reporting sidecar for Kubernetes clusters running on AWS.',
      topics: ['kubernetes', 'aws'],
      language: 'Go',
      stargazers_count: 88,
      owner: { login: 'alexkim' },
    }),
  ],
  observedAt: OBSERVED_AT,
}

export const caseBStackOverflow: StackDossierInput = {
  user: {
    user_id: 99002,
    display_name: 'Alex Kim',
    reputation: 8800,
    location: 'Boston, MA',
    website_url: 'https://alexdata.ai',
    link: 'https://stackoverflow.com/users/99002/alex-kim',
    creation_date: 1500000000,
    user_type: 'registered',
  },
  tagStats: [{ tag: 'kubernetes', window: 'all_time', postCount: 11, score: 190 }],
  observedAt: OBSERVED_AT,
}

/**
 * Case C: contamination probe. The role searches Kubernetes, Terraform and
 * AWS. This candidate's public GitHub work shows Go and PostgreSQL only.
 */
export const caseCGitHub: GitHubDossierInput = {
  user: {
    login: 'pat-nguyen',
    type: 'User',
    name: 'Pat Nguyen',
    location: 'Austin, TX',
    html_url: 'https://github.com/pat-nguyen',
    created_at: '2019-09-01T00:00:00Z',
  },
  repositories: [
    repo({
      id: 31,
      name: 'ledger-svc',
      full_name: 'pat-nguyen/ledger-svc',
      html_url: 'https://github.com/pat-nguyen/ledger-svc',
      description: 'Double entry ledger service with a PostgreSQL storage layer.',
      topics: ['postgresql'],
      language: 'Go',
      stargazers_count: 30,
      owner: { login: 'pat-nguyen' },
    }),
  ],
  observedAt: OBSERVED_AT,
}

/** Case D: observed Stack Overflow evidence for the tags the API returned. */
export const caseDStackOverflow: StackDossierInput = {
  user: {
    user_id: 99004,
    display_name: 'Rin Ito',
    reputation: 22100,
    link: 'https://stackoverflow.com/users/99004/rin-ito',
    creation_date: 1450000000,
    user_type: 'registered',
  },
  tagStats: [
    { tag: 'kubernetes', window: 'all_time', postCount: 24, score: 610 },
    { tag: 'terraform', window: 'month', postCount: 4, score: 33 },
  ],
  topAnswerTags: [{ tag: 'kubernetes', answerCount: 24, answerScore: 610 }],
  answers: [
    {
      answerId: '778001',
      tag: 'kubernetes',
      score: 74,
      isAccepted: true,
      creationDate: '2026-05-11T00:00:00.000Z',
      url: 'https://stackoverflow.com/a/778001',
    },
  ],
  observedAt: OBSERVED_AT,
}

/** Case E: an organization account, not a person. */
export const caseEGitHubOrganization: GitHubDossierInput = {
  user: {
    login: 'northwind-labs',
    type: 'Organization',
    name: 'Northwind Labs',
    location: 'Remote',
    html_url: 'https://github.com/northwind-labs',
    created_at: '2015-01-01T00:00:00Z',
  },
  repositories: [
    repo({
      id: 41,
      name: 'platform',
      full_name: 'northwind-labs/platform',
      topics: ['kubernetes'],
      language: 'Go',
      owner: { login: 'northwind-labs' },
    }),
  ],
  observedAt: OBSERVED_AT,
}

/** A fork-only account: artifacts exist, but nothing supports authorship. */
export const forkOnlyGitHub: GitHubDossierInput = {
  user: {
    login: 'forky',
    type: 'User',
    name: 'Forky McFork',
    html_url: 'https://github.com/forky',
    created_at: '2021-01-01T00:00:00Z',
  },
  repositories: [
    repo({
      id: 51,
      name: 'kubernetes',
      full_name: 'forky/kubernetes',
      html_url: 'https://github.com/forky/kubernetes',
      description: 'Production-Grade Container Scheduling and Management',
      fork: true,
      topics: ['kubernetes', 'go'],
      language: 'Go',
      stargazers_count: 0,
      forks_count: 0,
      owner: { login: 'forky' },
    }),
  ],
  observedAt: OBSERVED_AT,
}
