import type { ReactNode } from 'react'

type Props = {
  title: string
  area: string
  index: number
  action?: ReactNode
  note?: ReactNode
  children: ReactNode
}

export function Card({ title, area, index, action, note, children }: Props) {
  return (
    <section
      className="dx-card dx-section dx-rise"
      style={{ ['--i' as string]: index, gridArea: area }}
      aria-label={title}
    >
      <header className="dx-card-head">
        <h2>{title}</h2>
        {note && <span className="dx-sub">{note}</span>}
        {action}
      </header>
      {children}
    </section>
  )
}
