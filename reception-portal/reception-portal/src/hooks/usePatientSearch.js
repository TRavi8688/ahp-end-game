import { useState, useEffect, useRef } from 'react'
import receptionApi from '../services/receptionApi'

export function usePatientSearch() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const debounceRef             = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim() || query.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await receptionApi.searchPatients(query)
        setResults(Array.isArray(data) ? data : data.patients || [])
        setError(null)
      } catch {
        setError('Search failed')
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 320)

    return () => clearTimeout(debounceRef.current)
  }, [query])

  const clear = () => { setQuery(''); setResults([]) }

  return { query, setQuery, results, loading, error, clear }
}
