import { BooleanTool } from '@/components/BooleanTool'
export const metadata = {
  title: 'JD-to-Boolean Search Builder | SourcingOS',
  description: 'Paste a job description and get three ready-to-run search lanes — Precision, Balanced, and Market Map — with LinkedIn, Google/Bing X-Ray, and GitHub strings. Strips JD noise automatically. Free, no account.',
}
export default function Page(){
  return (
    <main className="wrap">
      <span className="kicker">Free Tool</span>
      <h1>JD-to-Boolean Search Builder</h1>
      <p className="lead">
        Paste a full job description. The builder pulls out the search-relevant signals, drops the
        soft-skill and HR noise that wrecks Boolean strings, and gives you three lanes — Precision,
        Balanced, and Market Map — each with LinkedIn Recruiter, Google/Bing X-Ray, and GitHub
        versions, plus copy and launch buttons.
      </p>
      <BooleanTool />
    </main>
  )
}
