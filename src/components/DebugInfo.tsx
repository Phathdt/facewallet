import { useEffect, useState } from 'react'

export function DebugInfo() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Show debug info in development or if ?debug=true in URL
    const params = new URLSearchParams(window.location.search)
    setIsVisible(import.meta.env.DEV || params.get('debug') === 'true')
  }, [])

  if (!isVisible) return null

  return (
    <div className="fixed right-4 bottom-4 z-50 max-w-md rounded-lg border border-gray-300 bg-black p-4 text-xs text-white shadow-lg">
      <div className="mb-2 font-bold">Debug Info</div>
      <div className="space-y-1">
        <div>
          <span className="text-gray-400">Mode:</span> {import.meta.env.MODE}
        </div>
        <div>
          <span className="text-gray-400">VITE_RP_ID:</span>{' '}
          {import.meta.env.VITE_RP_ID || '(not set)'}
        </div>
        <div>
          <span className="text-gray-400">VITE_RP_NAME:</span>{' '}
          {import.meta.env.VITE_RP_NAME || '(not set)'}
        </div>
        <div>
          <span className="text-gray-400">hostname:</span>{' '}
          {window.location.hostname}
        </div>
        <div>
          <span className="text-gray-400">origin:</span>{' '}
          {window.location.origin}
        </div>
        <div className="mt-2 text-[10px] text-gray-500">
          Add ?debug=true to URL to show in production
        </div>
      </div>
    </div>
  )
}
