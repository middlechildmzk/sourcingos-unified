import Link from 'next/link'

export const metadata = {
  alternates: { canonical: '/contact/' },
  title: 'Contact | SourcingOS',
  description: 'How to reach SourcingOS during the private beta: access requests, product questions, and privacy or data requests.'
}

export default function ContactPage() {
  return <main className="wrap article">
    <span className="kicker">Contact</span>
    <h1>Contact SourcingOS</h1>
    <p className="lead">During beta, the request form is the fastest channel. Every submission gets read.</p>

    <section>
      <h2>Beta access and product questions</h2>
      <p>Use the beta request form and include your question or context. Access requests and product feedback both go through the same queue.</p>
      <p><Link className="btn" href="/waitlist">Open the request form</Link></p>
    </section>

    <section>
      <h2>Already in the beta</h2>
      <p>Reply directly to your invite email. That thread reaches us fastest.</p>
    </section>

    <section>
      <h2>Privacy and data requests</h2>
      <p>If you want your submitted information corrected or removed, say so in the form and it will be handled with priority. The privacy policy covers what we store and why.</p>
      <p><Link className="btn secondary" href="/privacy">Read the privacy policy</Link></p>
    </section>
  </main>
}
