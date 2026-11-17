import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ContextLink as Link } from '../../shared/ui/ContextLink'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddRounded from '@mui/icons-material/AddRounded'
import { PageHeading } from '../../shared/ui/PageHeading'
import { ProblemAlert } from '../../shared/ui/ProblemAlert'
import { CatalogNavigation } from './CatalogNavigation'
import { CatalogSelect } from './CatalogSelect'
import {
  createCondominium,
  getOption,
  listCondominiums,
  updateCondominium,
} from './api'
import type { Condominium } from './api'

function OrganizationLabel({ id }: { id: string | null }) {
  const query = useQuery({
    queryKey: ['organizations', 'detail', id],
    queryFn: ({ signal }) => getOption('organizations', id!, signal),
    enabled: !!id,
  })
  if (!id) return <>Independiente</>
  return (
    <>
      {query.data?.name ??
        (query.isError ? 'Organización no disponible' : 'Cargando…')}
    </>
  )
}

export function CondominiumsPage() {
  const [params, setParams] = useSearchParams()
  const client = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Condominium | null>(null)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [error, setError] = useState<unknown>(null)
  const page = Math.max(1, Number(params.get('page') ?? 1) || 1)
  const search = params.get('search') ?? ''
  const selectedOrganization = params.get('organizationId') ?? ''
  const query = useQuery({
    queryKey: ['condominiums', 'list', { page, search, selectedOrganization }],
    queryFn: ({ signal }) =>
      listCondominiums(
        {
          page,
          pageSize: 25,
          search,
          organizationId: selectedOrganization || undefined,
        },
        signal,
      ),
  })
  const close = () => {
    setCreating(false)
    setEditing(null)
    setError(null)
  }
  const mutation = useMutation({
    mutationFn: () =>
      editing
        ? updateCondominium(editing.id, {
            name: name.trim(),
            address: address.trim(),
          })
        : createCondominium({
            name: name.trim(),
            address: address.trim(),
            organizationId: organizationId || null,
          }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['condominiums'] })
      close()
    },
    onError: setError,
    retry: false,
  })
  const openNew = () => {
    setName('')
    setAddress('')
    setOrganizationId('')
    setError(null)
    setCreating(true)
  }
  const openEdit = (item: Condominium) => {
    setName(item.name)
    setAddress(item.address)
    setError(null)
    setEditing(item)
  }
  const updateSearch = (value: string) => {
    setParams((old) => {
      const next = new URLSearchParams(old)
      if (value) next.set('search', value)
      else next.delete('search')
      next.delete('page')
      return next
    })
  }
  return (
    <>
      <PageHeading
        eyebrow="CONFIGURACIÓN / CATÁLOGOS"
        title="Condominios"
        description="Organiza comunidades, propiedades y su medidor principal."
        action={
          <Button
            variant="contained"
            startIcon={<AddRounded />}
            onClick={openNew}
          >
            Nuevo condominio
          </Button>
        }
      />
      <CatalogNavigation />
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <TextField
            label="Buscar por nombre"
            size="small"
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            sx={{ width: { xs: '100%', sm: 320 } }}
          />
          <Box sx={{ width: { xs: '100%', sm: 340 } }}>
            <CatalogSelect
              id="condominium-organization-filter"
              kind="organizations"
              label="Organización"
              value={selectedOrganization}
              onChange={(item) =>
                setParams((old) => {
                  const next = new URLSearchParams(old)
                  if (item) next.set('organizationId', item.id)
                  else next.delete('organizationId')
                  next.delete('page')
                  return next
                })
              }
            />
          </Box>
        </Stack>
        {query.isError ? (
          <Stack spacing={2}>
            <ProblemAlert error={query.error} />
            <Button onClick={() => void query.refetch()}>Reintentar</Button>
          </Stack>
        ) : query.isPending ? (
          <Box role="status" aria-label="Cargando condominios">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} height={54} />
            ))}
          </Box>
        ) : query.data.items.length === 0 ? (
          <Typography role="status" color="text.secondary" sx={{ py: 4 }}>
            {search || selectedOrganization
              ? 'No hay condominios que coincidan con los filtros.'
              : 'Aún no hay condominios registrados.'}
          </Typography>
        ) : (
          <TableContainer>
            <Table aria-label="Condominios registrados">
              <TableHead>
                <TableRow>
                  <TableCell>Condominio</TableCell>
                  <TableCell>Dirección</TableCell>
                  <TableCell>Organización</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {query.data.items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Button
                        component={Link}
                        to={`/configuracion/condominios/${item.id}`}
                        sx={{ textTransform: 'none' }}
                      >
                        {item.name}
                      </Button>
                    </TableCell>
                    <TableCell>{item.address}</TableCell>
                    <TableCell>
                      <OrganizationLabel id={item.organizationId} />
                    </TableCell>
                    <TableCell align="right">
                      <Button onClick={() => openEdit(item)}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {query.data && (
          <Stack
            direction="row"
            sx={{
              mt: 2,
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {query.data.totalCount} condominios
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                disabled={page <= 1 || query.isFetching}
                onClick={() =>
                  setParams((old) => {
                    const next = new URLSearchParams(old)
                    next.set('page', String(page - 1))
                    return next
                  })
                }
              >
                Anterior
              </Button>
              <Button
                disabled={!query.data.hasNextPage || query.isFetching}
                onClick={() =>
                  setParams((old) => {
                    const next = new URLSearchParams(old)
                    next.set('page', String(page + 1))
                    return next
                  })
                }
              >
                Siguiente
              </Button>
            </Stack>
          </Stack>
        )}
      </Paper>
      <Dialog
        open={creating || !!editing}
        onClose={close}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {editing ? 'Editar condominio' : 'Nuevo condominio'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {Boolean(error) && <ProblemAlert error={error} />}
            <TextField
              label="Nombre"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 200 } }}
            />
            <TextField
              label="Dirección"
              required
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 500 } }}
            />
            {!editing && (
              <CatalogSelect
                id="new-condominium-organization"
                kind="organizations"
                label="Organización (opcional)"
                value={organizationId}
                onChange={(item) => setOrganizationId(item?.id ?? '')}
                helperText="Déjalo vacío para un condominio independiente."
              />
            )}
            {editing && (
              <Typography variant="body2" color="text.secondary">
                La organización existente no cambia al editar el condominio.
              </Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={mutation.isPending || !name.trim() || !address.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? 'Guardando…'
              : editing
                ? 'Guardar cambios'
                : 'Crear condominio'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
