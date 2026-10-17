import Link from 'next/link'
import type { Payload } from 'payload'

/**
 * The dashboard's first panel, laid out like the app's Today screen: a large
 * "Summary" title and a card per catalogue, its published count in the
 * catalogue's colour and how many drafts are waiting.
 */

const CATALOGUES = [
  { slug: 'exercises', label: 'Exercises', color: '#D6F25A' },
  { slug: 'foods', label: 'Foods', color: '#5AB0FF' },
  { slug: 'awards', label: 'Awards', color: '#FF9F0A' },
] as const

export const Summary = async ({ payload }: { payload: Payload }) => {
  const counts = await Promise.all(
    CATALOGUES.map(async ({ slug }) => {
      const [published, drafts] = await Promise.all([
        payload.count({ collection: slug, where: { _status: { equals: 'published' } } }),
        payload.count({ collection: slug, where: { _status: { equals: 'draft' } } }),
      ])
      return { published: published.totalDocs, drafts: drafts.totalDocs }
    }),
  )

  return (
    <section className="fitsyn-summary">
      <h1>Summary</h1>
      <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
      <div className="fitsyn-summary__grid">
        {CATALOGUES.map(({ slug, label, color }, i) => (
          <Link key={slug} href={`/admin/collections/${slug}`} className="fitsyn-summary__card">
            <span className="fitsyn-summary__title">
              {label}
              <span className="fitsyn-summary__chevron">›</span>
            </span>
            <span className="fitsyn-summary__value" style={{ color }}>
              {counts[i].published.toLocaleString()}
              <small>LIVE</small>
            </span>
            <span className="fitsyn-summary__caption">
              {counts[i].drafts ? `${counts[i].drafts} draft${counts[i].drafts === 1 ? '' : 's'} waiting` : 'Nothing waiting'}
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}
