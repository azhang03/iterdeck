import type { ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { highlightCode } from '@lezer/highlight'
import { pythonLanguage } from '@codemirror/lang-python'
import { PostgreSQL } from '@codemirror/lang-sql'
import { codeHighlighter } from '../editor/highlight.ts'

type Parser = typeof pythonLanguage.parser

type Props = { text: string; className?: string }

// A card side as markdown. Styles live under .card-text in index.css.
// Single line breaks stay line breaks (remark-breaks), so a card written as
// plain text keeps its lines; leading spaces are markdown's to drop, so
// indented code needs a fenced block. Raw HTML shows as text. A link opens
// in a new tab and does not flip the card it sits on.
export default function CardText({ text, className }: Props) {
  return (
    <div className={className ? `card-text ${className}` : 'card-text'}>
      {text ? (
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
          {text}
        </ReactMarkdown>
      ) : (
        <span className="text-muted">(empty)</span>
      )}
    </div>
  )
}

// Fenced blocks tagged with a language the editor knows are highlighted
// with the same parser. Other languages are plain monospace.
const parsers: Record<string, Parser> = {
  python: pythonLanguage.parser,
  py: pythonLanguage.parser,
  sql: PostgreSQL.language.parser,
  postgresql: PostgreSQL.language.parser,
  postgres: PostgreSQL.language.parser,
  pgsql: PostgreSQL.language.parser,
}

const components: Components = {
  code({ className, children }) {
    const lang = /language-([\w-]+)/.exec(className ?? '')?.[1]?.toLowerCase()
    const parser = lang ? parsers[lang] : undefined
    if (!parser || typeof children !== 'string') return <code className={className}>{children}</code>
    return <code className={className}>{highlight(children, parser)}</code>
  },
  // In-page links (GFM footnotes) stay in the tab; the rest open a new one.
  a({ node: _node, ...props }) {
    const inPage = props.href?.startsWith('#')
    return <a {...props} target={inPage ? undefined : '_blank'} rel={inPage ? undefined : 'noreferrer'} onClick={(e) => e.stopPropagation()} />
  },
}

function highlight(code: string, parser: Parser): ReactNode[] {
  const out: ReactNode[] = []
  highlightCode(
    code,
    parser.parse(code),
    codeHighlighter,
    (part, classes) => {
      out.push(
        classes ? (
          <span key={out.length} className={classes}>
            {part}
          </span>
        ) : (
          part
        ),
      )
    },
    () => out.push('\n'),
  )
  return out
}
