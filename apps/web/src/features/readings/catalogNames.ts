import { useQueries } from '@tanstack/react-query'
import { getMeter, getProperty } from '../catalogs/api'
import type { Reading } from './api'

export function useReadingMeterNames(rows: Reading[] = []) {
  const ids = [...new Set(rows.map((row) => row.meterId))]
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['meters', 'detail', id],
      queryFn: ({ signal }) => getMeter(id, signal),
    })),
  })

  return new Map(
    ids.map((id, i) => [id, queries[i].data?.serialNumber ?? `Medidor ${id}`]),
  )
}

export function useReadingPropertyNames(rows: Reading[] = []) {
  const ids = [...new Set(rows.flatMap((row) => row.propertyId ?? []))]
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['properties', 'detail', id],
      queryFn: ({ signal }) => getProperty(id, signal),
    })),
  })

  return new Map(
    ids.map((id, i) => [id, queries[i].data?.name ?? `Propiedad ${id}`]),
  )
}
