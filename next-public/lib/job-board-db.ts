export type EmployerJobSubmission = {
  id: string
  email: string
  companyName: string
  jobTitle: string
  jobUrl: string
  salaryRange?: string
  location?: string
  remoteType?: string
  notes?: string
  status: 'pending' | 'approved' | 'rejected'
  submittedAt: string
  reviewedAt?: string
}

const globalForJobs = globalThis as unknown as { __sourcingosJobSubmissions?: EmployerJobSubmission[] }

export function jobUid(prefix = 'jobsub') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function getJobSubmissions() {
  if (!globalForJobs.__sourcingosJobSubmissions) globalForJobs.__sourcingosJobSubmissions = []
  return globalForJobs.__sourcingosJobSubmissions
}

export function addJobSubmission(input: Omit<EmployerJobSubmission, 'id' | 'status' | 'submittedAt'>) {
  const submission: EmployerJobSubmission = { id: jobUid(), status: 'pending', submittedAt: new Date().toISOString(), ...input }
  getJobSubmissions().unshift(submission)
  return submission
}

export function updateJobSubmissionStatus(id: string, status: 'approved' | 'rejected') {
  const item = getJobSubmissions().find(submission => submission.id === id)
  if (!item) return null
  item.status = status
  item.reviewedAt = new Date().toISOString()
  return item
}
