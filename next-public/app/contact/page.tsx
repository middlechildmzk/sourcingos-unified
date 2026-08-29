import Link from 'next/link'
import ContactForm from '@/components/ContactForm'

export const metadata = {
  alternates: { canonical: '/contact/' },
  title: 'Contact | SourcingOS',
  description: 'Contact SourcingOS about beta access, product questions, privacy or candidate-data requests, and security reports.'
}

export default function ContactPage() {
  return <main className="wrap article">
    <span className="kicker">Contact</span>
    <h1>Contact SourcingOS</h1>
    <p className="lead">Use this channel for product questions, privacy and candidate-data requests, or private security reports.</p>

    <section className="grid two">
      <div>
        <h2>Privacy and candidate-data requests</h2>
        <p>If you believe SourcingOS stores a candidate record or public-source evidence about you that should be accessed, corrected, or removed, choose the candidate-data or privacy request type. Share only enough information to locate the record.</p>
        <p>We may ask for reasonable identity verification before disclosing or deleting personal data so a request cannot be used to access or erase someone else&apos;s information.</p>
      </div>
      <div>
        <h2>Security reports</h2>
        <p>Security researchers can report suspected vulnerabilities through this form. Please do not include passwords, access tokens, API keys, private candidate data, or other secrets in the initial report.</p>
        <p><Link href="/.well-known/security.txt">Read security.txt</Link></p>
      </div>
    </section>

    <ContactForm />

    <section>
      <h2>Beta access</h2>
      <p>For beta access requests, continue to use the beta request form so those requests stay in the correct queue.</p>
      <p><Link className="btn secondary" href="/waitlist">Request beta access</Link></p>
    </section>

    <section>
      <h2>Data handling</h2>
      <p>The privacy policy explains the candidate and recruiter data SourcingOS may store, why it is used, current beta retention behavior, and how removal requests are handled.</p>
      <p><Link className="btn secondary" href="/privacy">Read the privacy policy</Link></p>
    </section>
  </main>
}
