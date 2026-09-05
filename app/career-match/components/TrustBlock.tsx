export function TrustBlock() {
  return (
    <section className="cm-trust card">
      <span className="kicker">Trust model</span>
      <h2>Built to avoid fake career advice.</h2>
      <div className="grid two">
        <div>
          <h3>No invented resume facts</h3>
          <p className="muted">The free report uses deterministic parsing and clearly separates resume facts from conditional positioning ideas.</p>
        </div>
        <div>
          <h3>No auto-apply</h3>
          <p className="muted">The tool opens original job postings. It does not submit applications or contact employers for the user.</p>
        </div>
        <div>
          <h3>Uploads are not stored</h3>
          <p className="muted">PDF, DOCX, TXT, or pasted resume text is sent to the server, parsed in memory for this report, and not stored or returned in the response.</p>
        </div>
        <div>
          <h3>Clearance is never verified by AI</h3>
          <p className="muted">Clearance terms are treated as unverified breadcrumbs unless the user verifies them outside the tool.</p>
        </div>
      </div>
    </section>
  )
}
