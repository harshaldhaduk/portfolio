export function SectionHeader({
  glyph,
  label,
}: {
  glyph: string
  label: string
}) {
  return (
    <h2 className="mb-8 flex items-center gap-3 text-xs tracking-[0.2em] text-muted uppercase">
      <span aria-hidden="true" className="text-dwarf">
        {glyph}
      </span>
      {label}
      <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
    </h2>
  )
}
