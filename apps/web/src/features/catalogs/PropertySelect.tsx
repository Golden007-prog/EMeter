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
import { getProperty, listProperties } from './api'
import type { Property } from './api'

export function PropertySelect({
  value,
  onChange,
  disabled,
  optional = false,
}: {
  value: string
  onChange: (property: Property | null) => void
  disabled?: boolean
  optional?: boolean
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const selected = useQuery({
    queryKey: ['properties', 'detail', value],
    queryFn: ({ signal }) => getProperty(value, signal),
    enabled: !!value,
  })
  const options = useInfiniteQuery({
    queryKey: ['properties', 'options', search],
    queryFn: ({ pageParam, signal }) =>
      listProperties({ page: pageParam, pageSize: 50, search }, signal),
    initialPageParam: 1,
    getNextPageParam: (page) =>
      page.hasNextPage ? page.pageNumber + 1 : undefined,
    enabled: open,
  })
  const items = options.data?.pages.flatMap((page) => page.items) ?? []
  const current =
    items.find((item) => item.id === value) ?? selected.data ?? null
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
        getOptionLabel={(property) => `${property.name} · ${property.address}`}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        filterOptions={(values) => values}
        onChange={(_, property) => onChange(property)}
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
        loadingText="Cargando propiedades…"
        noOptionsText={
          options.isError
            ? 'No se pudieron cargar las propiedades.'
            : 'No hay propiedades coincidentes.'
        }
        clearText="Quitar selección"
        openText="Mostrar opciones"
        closeText="Cerrar opciones"
        renderOption={(props, property) => (
          <li {...props} key={property.id}>
            <Box>
              <Typography>{property.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {property.address} · {property.resourceType}
              </Typography>
            </Box>
          </li>
        )}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Propiedad"
            required={!optional}
            error={selected.isError}
            helperText={
              selected.isError
                ? 'No se pudo recuperar la propiedad seleccionada.'
                : optional
                  ? 'Todas las propiedades si no seleccionas una.'
                  : 'Selecciona la propiedad por nombre y dirección.'
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
          Cargar más propiedades{' '}
          {options.isFetchingNextPage && (
            <CircularProgress size={12} sx={{ ml: 1 }} />
          )}
        </Button>
      )}
    </Box>
  )
}
