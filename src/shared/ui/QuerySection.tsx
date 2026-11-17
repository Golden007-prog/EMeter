import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { Button, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { ProblemAlert } from './ProblemAlert'

export function QuerySection<T>({
  title,
  query,
  children,
}: {
  title: string
  query: UseQueryResult<T, Error>
  children: (data: T) => ReactNode
}) {
  return (
    <Paper component="section" variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
        {title}
      </Typography>
      {query.isError ? (
        <Stack spacing={1}>
          <ProblemAlert error={query.error} />
          <Button onClick={() => void query.refetch()}>
            Reintentar {title.toLowerCase()}
          </Button>
        </Stack>
      ) : query.isPending ? (
        <Skeleton height={100} aria-label={`Cargando ${title}`} />
      ) : (
        children(query.data)
      )}
    </Paper>
  )
}
