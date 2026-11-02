import { useEffect, useState } from 'react'

export default function Home() {
  const [health, setHealth] = useState('checking')
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(d.ok ? 'ok' : 'error'))
      .catch(() => setHealth('error'))
  }, [])
  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Iterdeck</h1>
      <p className="text-gray-600">API: {health}</p>
    </main>
  )
}
