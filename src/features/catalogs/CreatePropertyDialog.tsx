import { useEffect, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ApiError } from '../../shared/api/client'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import { CatalogSelect } from './CatalogSelect'
import {
  createProperty,
  createPropertySchema,
  resourceLabels,
  resourceTypes,
} from './api'
import type { CreatePropertyForm, Property } from './api'

export function CreatePropertyDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (property: Property) => void
}) {
  const client = useQueryClient()
  const submitting = useRef(false)
  const pendingFocus = useRef<keyof CreatePropertyForm | null>(null)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const form = useForm<CreatePropertyForm>({
    resolver: zodResolver(createPropertySchema),
    defaultValues: {
      name: '',
      address: '',
      resourceType: 'water',
      organizationId: '',
      condominiumId: '',
    },
  })
  const mutation = useMutation({ mutationFn: createProperty, retry: false })
  const busy = form.formState.isSubmitting
  useEffect(() => {
    // Server validation arrives while fields are disabled. Focus after unlocking.
    if (!busy && pendingFocus.current) {
      form.setFocus(pendingFocus.current)
      pendingFocus.current = null
    }
  }, [busy, form])
  const { ref: nameRef, ...nameField } = form.register('name')
  const { ref: addressRef, ...addressField } = form.register('address')
  const errors = form.formState.errors
  const organizationId = form.watch('organizationId')
  const save = form.handleSubmit(async (values) => {
    if (submitting.current) return
    submitting.current = true
    setSubmitError(null)
    try {
      const property = await mutation.mutateAsync(values)
      await client.invalidateQueries({ queryKey: ['properties'] })
      onCreated(property)
      onClose()
    } catch (error) {
      setSubmitError(error)
      if (error instanceof ApiError && error.problem.errors) {
        for (const [key, messages] of Object.entries(error.problem.errors)) {
          const field = key.charAt(0).toLowerCase() + key.slice(1)
          if (
            [
              'name',
              'address',
              'resourceType',
              'organizationId',
              'condominiumId',
            ].includes(field)
          ) {
            form.setError(field as keyof CreatePropertyForm, {
              type: 'server',
              message: messages.join(' '),
            })
            pendingFocus.current ??= field as keyof CreatePropertyForm
          }
        }
      }
    } finally {
      submitting.current = false
    }
  })
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onClose()
      }}
      fullWidth
      maxWidth="sm"
      aria-labelledby="create-property-title"
      slotProps={{
        transition: {
          onEntered: () => {
            // Do not steal focus if the user already moved to another control
            // while the opening animation was still running.
            const active = document.activeElement
            const insideControl =
              active?.closest('[role="dialog"]') &&
              active.matches('input, textarea, button, [role="combobox"]')
            if (!insideControl) form.setFocus('name')
          },
        },
      }}
    >
      <DialogTitle id="create-property-title">Nueva propiedad</DialogTitle>
      <Box component="form" noValidate onSubmit={save}>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Typography variant="body2" color="text.secondary">
              Registra el lugar donde medirás tus servicios. Los campos con *
              son obligatorios.
            </Typography>
            {!!submitError && <ProblemAlert error={submitError} />}
            {submitError instanceof ApiError && submitError.status === 409 && (
              <Alert
                severity="warning"
                action={
                  <Button
                    color="inherit"
                    onClick={() =>
                      void client.invalidateQueries({
                        queryKey: ['properties'],
                      })
                    }
                  >
                    Actualizar lista
                  </Button>
                }
              >
                Conservamos tus datos. Revisa la información actualizada antes
                de volver a guardar.
              </Alert>
            )}
            <TextField
              label="Nombre de la propiedad"
              required
              autoFocus
              fullWidth
              disabled={busy}
              {...nameField}
              inputRef={nameRef}
              error={!!errors.name}
              helperText={
                errors.name?.message ??
                'Por ejemplo: Casa Los Aromos o Departamento 402.'
              }
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              label="Dirección"
              required
              fullWidth
              disabled={busy}
              {...addressField}
              inputRef={addressRef}
              error={!!errors.address}
              helperText={errors.address?.message}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            <Controller
              name="resourceType"
              control={form.control}
              render={({ field: { ref, ...field } }) => (
                <TextField
                  {...field}
                  inputRef={ref}
                  label="Recurso"
                  select
                  required
                  disabled={busy}
                  error={!!errors.resourceType}
                  helperText={
                    errors.resourceType?.message ??
                    'Los medidores de esta propiedad usarán este recurso.'
                  }
                >
                  {resourceTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {resourceLabels[type]}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
              <Typography variant="subtitle2">Pertenencia opcional</Typography>
              <Typography variant="body2" color="text.secondary">
                Deja ambas opciones vacías para registrar una propiedad
                independiente.
              </Typography>
            </Box>
            <Controller
              name="organizationId"
              control={form.control}
              render={({ field }) => (
                <CatalogSelect
                  id="property-organization"
                  kind="organizations"
                  label="Organización (opcional)"
                  value={field.value}
                  disabled={busy}
                  inputRef={field.ref}
                  onBlur={field.onBlur}
                  error={!!errors.organizationId}
                  helperText={errors.organizationId?.message}
                  onChange={(item) => {
                    field.onChange(item?.id ?? '')
                    form.setValue('condominiumId', '')
                  }}
                />
              )}
            />
            <Controller
              name="condominiumId"
              control={form.control}
              render={({ field }) => (
                <CatalogSelect
                  id="property-condominium"
                  kind="condominiums"
                  label="Condominio (opcional)"
                  value={field.value}
                  organizationId={organizationId || undefined}
                  disabled={busy}
                  inputRef={field.ref}
                  onBlur={field.onBlur}
                  error={!!errors.condominiumId}
                  helperText={
                    errors.condominiumId?.message ??
                    'Al elegir un condominio, se completa su organización si corresponde.'
                  }
                  onChange={(item) => {
                    field.onChange(item?.id ?? '')
                    if (item && 'organizationId' in item)
                      form.setValue('organizationId', item.organizationId ?? '')
                  }}
                />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? 'Guardando…' : 'Crear propiedad'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
