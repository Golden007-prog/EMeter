import { useState } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material'
import {
  getBillingPeriod,
  getMeter,
  getProperty,
  listBillingPeriods,
  listMeters,
} from '../catalogs/api'
import type { BillingPeriod, Meter } from '../catalogs/api'

function MeterContext({ meter }: { meter: Meter }) {
  const property = useQuery({
    queryKey: ['properties', 'detail', meter.propertyId],
    queryFn: ({ signal }) => getProperty(meter.propertyId, signal),
  })
  return (
    <Box>
      <Typography>
        {meter.serialNumber} ·{' '}
        {property.data?.name ??
          (property.isError
            ? 'Propiedad no disponible'
            : 'Cargando propiedad…')}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {meter.resourceType} · {meter.unit}
        {meter.model ? ` · ${meter.model}` : ''}
      </Typography>
    </Box>
  )
}

export function MeterSelect({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (meter: Meter | null) => void
  disabled?: boolean
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const selected = useQuery({
    queryKey: ['meters', 'detail', value],
    queryFn: ({ signal }) => getMeter(value, signal),
    enabled: !!value,
  })
  const options = useInfiniteQuery({
    queryKey: ['meters', 'options', search],
    queryFn: ({ pageParam, signal }) =>
      listMeters({ page: pageParam, pageSize: 50, search }, signal),
    initialPageParam: 1,
    getNextPageParam: (page) =>
      page.hasNextPage ? page.pageNumber + 1 : undefined,
    enabled: open,
  })
  const items = options.data?.pages.flatMap((page) => page.items) ?? []
  const current =
    items.find((meter) => meter.id === value) ?? selected.data ?? null
  return (
    <Box>
      <Autocomplete
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        options={items}
        value={current}
        disabled={disabled}
        loading={options.isFetching}
        getOptionLabel={(meter) => meter.serialNumber}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        filterOptions={(values) => values}
        onChange={(_, meter) => onChange(meter)}
        onInputChange={(_, text, reason) => {
          if (reason === 'input') setSearch(text)
          if (reason === 'clear') setSearch('')
        }}
        slotProps={{
          listbox: {
            onScroll: (event) => {
              const list = event.currentTarget
              if (
                list.scrollHeight - list.scrollTop - list.clientHeight < 48 &&
                options.hasNextPage &&
                !options.isFetching
              )
                void options.fetchNextPage()
            },
          },
        }}
        renderOption={(props, meter) => (
          <li {...props} key={meter.id}>
            <MeterContext meter={meter} />
          </li>
        )}
        loadingText="Cargando medidores…"
        noOptionsText="No hay medidores coincidentes."
        clearText="Quitar selección"
        openText="Mostrar opciones"
        closeText="Cerrar opciones"
        renderInput={(params) => (
          <TextField
            {...params}
            label="Medidor"
            required
            error={selected.isError}
            helperText={
              selected.isError
                ? 'No se pudo recuperar el medidor seleccionado.'
                : 'Busca por número de serie y verifica la propiedad.'
            }
          />
        )}
      />
      {options.hasNextPage && (
        <Button
          size="small"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setOpen(true)
            void options.fetchNextPage()
          }}
        >
          Cargar más medidores{' '}
          {options.isFetchingNextPage && (
            <CircularProgress size={12} sx={{ ml: 1 }} />
          )}
        </Button>
      )}
    </Box>
  )
}

function periodLabel(period: BillingPeriod) {
  const start = new Date(period.start).toLocaleDateString('es-CL', {
    timeZone: 'America/Santiago',
  })
  const end = new Date(period.end).toLocaleDateString('es-CL', {
    timeZone: 'America/Santiago',
  })
  return `${start} a ${end} · ${period.status === 'Closed' ? 'Cerrado' : period.status === 'Open' ? 'Abierto' : period.status === 'Collecting' ? 'En recopilación' : 'En validación'}`
}

export function BillingPeriodSelect({
  value,
  onChange,
  disabled,
  optional = false,
  label,
}: {
  value: string
  onChange: (period: BillingPeriod | null) => void
  disabled?: boolean
  optional?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = useQuery({
    queryKey: ['billing-periods', 'detail', value],
    queryFn: ({ signal }) => getBillingPeriod(value, signal),
    enabled: !!value,
  })
  const options = useInfiniteQuery({
    queryKey: ['billing-periods', 'options'],
    queryFn: ({ pageParam, signal }) =>
      listBillingPeriods({ page: pageParam, pageSize: 50 }, signal),
    initialPageParam: 1,
    getNextPageParam: (page) =>
      page.hasNextPage ? page.pageNumber + 1 : undefined,
    enabled: open,
  })
  const items = options.data?.pages.flatMap((page) => page.items) ?? []
  const current =
    items.find((period) => period.id === value) ?? selected.data ?? null
  return (
    <Box>
      <Autocomplete
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        options={items}
        value={current}
        disabled={disabled}
        loading={options.isFetching}
        getOptionLabel={periodLabel}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        filterOptions={(values) => values}
        onChange={(_, period) => onChange(period)}
        onInputChange={(_, _text, reason) => {
          if (reason === 'clear') onChange(null)
        }}
        slotProps={{
          listbox: {
            onScroll: (event) => {
              const list = event.currentTarget
              if (
                list.scrollHeight - list.scrollTop - list.clientHeight < 48 &&
                options.hasNextPage &&
                !options.isFetching
              )
                void options.fetchNextPage()
            },
          },
        }}
        loadingText="Cargando períodos…"
        noOptionsText="No hay períodos disponibles."
        clearText="Quitar selección"
        openText="Mostrar opciones"
        closeText="Cerrar opciones"
        renderInput={(params) => (
          <TextField
            {...params}
            label={label ?? (optional ? 'Período (opcional)' : 'Período')}
            required={!optional}
            error={selected.isError}
            helperText={
              selected.isError
                ? 'No se pudo recuperar el período seleccionado.'
                : optional
                  ? 'Puedes dejar el período sin seleccionar.'
                  : undefined
            }
          />
        )}
      />
      {options.hasNextPage && (
        <Button
          size="small"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setOpen(true)
            void options.fetchNextPage()
          }}
        >
          Cargar más períodos{' '}
          {options.isFetchingNextPage && (
            <CircularProgress size={12} sx={{ ml: 1 }} />
          )}
        </Button>
      )}
    </Box>
  )
}
