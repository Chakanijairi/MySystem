export default function PlaceholderPage({ title, description }) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        {description || 'This section is coming soon.'}
      </p>
    </div>
  )
}
