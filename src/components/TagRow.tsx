export function TagRow({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <li
          key={tag}
          data-cursor-target
          className="rounded-full border border-hairline px-2.5 py-0.5 text-[11px] text-muted transition-[transform,color,border-color] duration-200 hover:-translate-y-0.5 hover:border-dwarf/50 hover:text-ink"
        >
          {tag}
        </li>
      ))}
    </ul>
  )
}
