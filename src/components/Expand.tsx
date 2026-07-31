export function Expand({ children }: { children: string }) {
  return (
    <details className="group mt-3">
      <summary className="cursor-pointer text-[11px] tracking-wider text-dwarf/70 uppercase transition-colors hover:text-dwarf focus-visible:text-dwarf">
        More detail
      </summary>
      <p className="mt-3 border-l border-hairline pl-4 text-sm leading-relaxed text-muted">
        {children}
      </p>
    </details>
  )
}
