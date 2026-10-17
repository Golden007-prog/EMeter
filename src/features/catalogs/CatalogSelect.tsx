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
import { getOption, listOptions } from './api'
import type { CatalogKind, CatalogOption } from './api'

export function CatalogSelect({
  kind,
  label,
  value,
  onChange,
  organizationId,
  disabled,
  helperText,
  error,
  inputRef,
  onBlur,
  id,
}: {
  kind: CatalogKind
  label: string
  value: string
  onChange: (value: CatalogOption | null) => void
  organizationId?: string
  disabled?: boolean
  helperText?: string
  error?: boolean
  inputRef?: (element: HTMLInputElement | null) => void
  onBlur?: () => void
  id: string
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const selected = useQuery({
    queryKey: [kind, 'detail', value],
    queryFn: ({ signal }) => getOption(kind, value, signal),
    enabled: !!value,
  })
  const options = useInfiniteQuery({
    queryKey: [kind, 'options', search, organizationId],
    queryFn: ({ pageParam, signal }) =>
      listOptions(kind, pageParam, search, organizationId, signal),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.hasNextPage ? last.pageNumber + 1 : undefined,
    enabled: open,
  })
  const all = options.data?.pages.flatMap((page) => page.items) ?? []
  const current = all.find((item) => item.id === value) ?? selected.data ?? null
  return (
    <Box>
      <Autocomplete
        id={id}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        options={all}
        value={current}
        disabled={disabled}
        loading={options.isFetching}
        slotProps={{
          listbox: {
            onScroll: (event) => {
              const list = event.currentTarget
              if (
                list.scrollHeight - list.scrollTop - list.clientHeight < 48 &&
                options.hasNextPage &&
                !options.isFetching
              ) {
                void options.fetchNextPage()
              }
            },
          },
        }}
        getOptionLabel={(option) =>
          option.name + ('address' in option ? ` · ${option.address}` : '')
        }
        isOptionEqualToValue={(a, b) => a.id === b.id}
        filterOptions={(items) => items}
        onChange={(_, option) => onChange(option)}
        onInputChange={(_, text, reason) => {
          if (reason === 'input') setSearch(text)
          if (reason === 'clear') setSearch('')
        }}
        loadingText="Cargando opciones…"
        noOptionsText={
          options.isError
            ? 'No se pudieron cargar las opciones.'
            : 'No hay coincidencias.'
        }
        clearText="Quitar selección"
        openText="Mostrar opciones"
        closeText="Cerrar opciones"
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            inputRef={inputRef}
            onBlur={onBlur}
            error={error || selected.isError}
            helperText={
              selected.isError
                ? 'No se pudo recuperar la selección. Vuelve a seleccionarla.'
                : helperText
            }
          />
        )}
      />
      {options.isError && (
        <Button size="small" onClick={() => void options.refetch()}>
          Reintentar cargar opciones
        </Button>
      )}
      {options.hasNextPage && (
        <Button
          size="small"
          disabled={options.isFetchingNextPage}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setOpen(true)
            void options.fetchNextPage()
          }}
        >
          Cargar más opciones{' '}
          {options.isFetchingNextPage && (
            <CircularProgress size={12} sx={{ ml: 1 }} />
          )}
        </Button>
      )}
      {open && options.data && (
        <Typography variant="caption" color="text.secondary">
          {all.length} de {options.data.pages[0].totalCount} opciones. Puedes
          buscar por nombre.
        </Typography>
      )}
    </Box>
  )
}
