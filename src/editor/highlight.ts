import { tagHighlighter, tags as t } from '@lezer/highlight'

// One highlighter for the code editor and for the code blocks in card text, so
// both show the same colours. It gives class names only; index.css holds the
// colours of the light and the dark scheme.
// Python's parser does not mark `self` or built-in types, so those stay plain.
export const codeHighlighter = tagHighlighter([
  { tag: [t.controlKeyword, t.moduleKeyword], class: 'tok-control' },
  { tag: [t.keyword, t.bool, t.null, t.atom], class: 'tok-keyword' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], class: 'tok-function' },
  { tag: [t.className, t.typeName, t.namespace], class: 'tok-type' },
  { tag: t.number, class: 'tok-number' },
  { tag: [t.string, t.special(t.string), t.escape], class: 'tok-string' },
  { tag: t.comment, class: 'tok-comment' },
  { tag: t.invalid, class: 'tok-invalid' },
])
