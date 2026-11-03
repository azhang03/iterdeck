import type { ReactNode } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { classHighlighter, highlightCode } from '@lezer/highlight'
import { pythonLanguage } from '@codemirror/lang-python'
import { PostgreSQL } from '@codemirror/lang-sql'

type Parser = typeof pythonLanguage.parser

type Props = { text: string; className?: string }

// A card side as markdown. Styles live under .card-text in index.css.
// Single line breaks stay line breaks (remark-breaks), so cards written as
// plain text look as before. Raw HTML is not rendered.
export default function CardText({ text, className }: Props) {
  return (
    <div className={className ? `card-text ${className}` : 'card-text'}>
      {text ? (
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
          {text}
        </ReactMarkdown>
      ) : (
        <span className="text-gray-400">(empty)</span>
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
}

function highlight(code: string, parser: Parser): ReactNode[] {
  const out: ReactNode[] = []
  highlightCode(
    code,
    parser.parse(code),
    classHighlighter,
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
