import { Alert, AlertTitle, Typography } from '@mui/material'
import { ApiError, errorMessage } from '../api/client'

export function ProblemAlert({ error }: { error: unknown }) {
  const problem = error instanceof ApiError ? error.problem : undefined
  return (
    <Alert severity="error" role="alert">
      <AlertTitle>
        {error instanceof ApiError && error.status === 409
          ? 'Los datos cambiaron o existe un conflicto'
          : 'No se pudo completar la solicitud'}
      </AlertTitle>
      {errorMessage(error)}
      {problem?.errors &&
        Object.entries(problem.errors).map(([field, messages]) => (
          <Typography key={field} component="div" variant="body2">
            {messages.join(' ')}
          </Typography>
        ))}
      {problem?.traceId && (
        <Typography variant="caption" component="div">
          Referencia: {problem.traceId}
        </Typography>
      )}
    </Alert>
  )
}
