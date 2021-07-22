import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/Page.module.css'

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Vocdoni</title>
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          DVote JS examples
        </h1>

        <p className={styles.description}>
          Get started by editing{' '}
          <code className={styles.code}>pages/*</code>
        </p>

        <div className={styles.grid}>
          <Link href="/network">
            <a className={styles.card}>
              <h2>Network &rarr;</h2>
              <p>Basic example of connecting to gateways.</p>
            </a>
          </Link>

          <Link href="/metadata">
            <a className={styles.card}>
              <h2>Metadata &rarr;</h2>
              <p>Fetch metadata from entities and processes.</p>
            </a>
          </Link>

          <Link href="/signing">
            <a className={styles.card}>
              <h2>Signing &rarr;</h2>
              <p>Signing payloads using wallets and signers.</p>
            </a>
          </Link>

        </div>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://docs.vocdoni.io"
          target="_blank"
          rel="noopener noreferrer"
        >
          Vocdoni
        </a>
      </footer>
    </div>
  )
}

