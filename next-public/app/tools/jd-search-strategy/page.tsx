import { JDStrategyTool } from '@/components/JDStrategyTool'
export const metadata = { title: 'JD Search Strategy Tool', description: 'Turn a job description into search lanes, target titles, false positives, and tool recommendations.' }
export default function Page(){return <main className="wrap"><span className="kicker">Free Tool</span><h1>JD Search Strategy Tool</h1><p className="lead">Turn a messy JD into search lanes, target titles, must-have signals, HM calibration questions, and a downloadable source pack.</p><JDStrategyTool /></main>}
