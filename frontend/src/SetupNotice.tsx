export function SetupNotice() {
  return (
    <div className="shell">
      <main>
        <section className="gate">
          <h2>One more setup step</h2>
          <p>
            Sign-in needs a free Reown (WalletConnect) project ID. Create one at{' '}
            <a href="https://cloud.reown.com" target="_blank" rel="noopener noreferrer">cloud.reown.com</a>, add this site’s
            address as an allowed domain, then put it in <code>frontend/.env</code>:
          </p>
          <pre>VITE_REOWN_PROJECT_ID=your_project_id</pre>
          <p>Restart <code>npm run dev</code> afterwards.</p>
        </section>
      </main>
    </div>
  )
}
