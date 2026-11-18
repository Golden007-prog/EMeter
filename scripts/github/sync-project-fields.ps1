<#
.SYNOPSIS
    Asigna los campos "Fase" y "Esfuerzo (días)" a los elementos del tablero.

.DESCRIPTION
    Usa GraphQL directo en lugar de `gh project item-edit` porque el comando falla al
    resolver el tipo de propietario en proyectos de usuario. Espacia las mutaciones para
    no chocar con el límite secundario de la API y reintenta con espera creciente.

.PARAMETER ProjectNumber
    Número del tablero (por defecto 3, "EMeter · Roadmap").
#>
[CmdletBinding()]
param(
    [string]$Owner = 'cbinput',
    [string]$Repo = 'EMeter',
    [int]$ProjectNumber = 3,
    [double]$DelaySeconds = 2.2
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backlogDir = Join-Path $repoRoot 'docs/backlog'

function Invoke-GraphQL {
    param([string]$Query, [int]$Retries = 8)
    for ($attempt = 0; $attempt -lt $Retries; $attempt++) {
        $raw = gh api graphql -f query=$Query 2>&1 | Out-String
        try { $parsed = $raw | ConvertFrom-Json } catch { $parsed = $null }
        if ($parsed -and -not $parsed.errors) { return $parsed.data }
        if ($raw -match 'rate limit|secondary rate|abuse') {
            $wait = [Math]::Min(120, 20 * ($attempt + 1))
            Write-Host "    … límite de API, esperando $wait s"
            Start-Sleep -Seconds $wait
            continue
        }
        throw "GraphQL falló: $raw"
    }
    throw 'GraphQL agotó reintentos'
}

# ----------------------------------------------------------------- lectura del proyecto
$info = (Invoke-GraphQL @"
query {
  user(login: "$Owner") {
    projectV2(number: $ProjectNumber) {
      id
      fields(first: 50) {
        nodes {
          __typename
          ... on ProjectV2FieldCommon { id name }
          ... on ProjectV2SingleSelectField { id name options { id name } }
        }
      }
    }
  }
}
"@).user.projectV2

$projectId = $info.id
$faseField = $info.fields.nodes | Where-Object { $_.name -eq 'Fase' }
$effortField = $info.fields.nodes | Where-Object { $_.name -eq 'Esfuerzo (días)' }
if (-not $faseField -or -not $effortField) { throw 'Faltan los campos Fase o Esfuerzo (días) en el tablero.' }

# ----------------------------------------------------------------- elementos del tablero
function Get-ProjectItems {
    $found = @{}
    $titles = @{}
    $cursor = $null
    do {
        $after = if ($cursor) { ", after: `"$cursor`"" } else { '' }
        $page = (Invoke-GraphQL @"
query {
  user(login: "$Owner") {
    projectV2(number: $ProjectNumber) {
      items(first: 100$after) {
        pageInfo { hasNextPage endCursor }
        nodes { id content { ... on Issue { number title } } }
      }
    }
  }
}
"@).user.projectV2.items
        foreach ($node in $page.nodes) {
            if ($node.content.number) {
                $found[[int]$node.content.number] = $node.id
                $titles[[int]$node.content.number] = $node.content.title
            }
        }
        $cursor = $page.pageInfo.endCursor
    } while ($page.pageInfo.hasNextPage)
    [pscustomobject]@{ Items = $found; Titles = $titles }
}

$state = Get-ProjectItems
Write-Host "Elementos en el tablero: $($state.Items.Count)"

# Añade los issues que todavía no están en el tablero (por ejemplo, creados después del alta).
$restIssues = (gh api "repos/$Owner/$Repo/issues?state=all&per_page=100" | ConvertFrom-Json) |
    Where-Object { -not $_.pull_request }
$added = 0
foreach ($issue in $restIssues) {
    if ($state.Items.ContainsKey([int]$issue.number)) { continue }
    $mutation = @"
mutation {
  addProjectV2ItemById(input: { projectId: "$projectId", contentId: "$($issue.node_id)" }) {
    item { id }
  }
}
"@
    Invoke-GraphQL $mutation | Out-Null
    $added++
    Write-Host "  + tablero #$($issue.number)"
    Start-Sleep -Milliseconds ([int]($DelaySeconds * 1000))
}
if ($added -gt 0) {
    $state = Get-ProjectItems
    Write-Host "Elementos tras agregar: $($state.Items.Count)"
}
$items = $state.Items
$issueTitles = $state.Titles

# ----------------------------------------------------------------- especificación del backlog
$specs = @{}
foreach ($file in (Get-ChildItem $backlogDir -Filter '*.md')) {
    $content = Get-Content $file.FullName -Raw
    foreach ($section in ([regex]::Split($content, '(?m)^## ') | Select-Object -Skip 1)) {
        $lines = @($section -split "`r?`n")
        $title = $lines[0].Trim()
        if (-not $title) { continue }
        $phase = if ($title -match '^\[M(\d)\]') { [int]$matches[1] } else { $null }
        $effort = $null
        foreach ($line in $lines) {
            if ($line -match '^effort:\s*(\d+)$') { $effort = [int]$matches[1] }
        }
        $short = $title -replace '^\[M\d\]\s*', ''
        $specs[$short] = [pscustomobject]@{ Phase = $phase; Effort = $effort }
    }
}

$updated = 0
foreach ($number in ($items.Keys | Sort-Object)) {
    $itemId = $items[$number]
    if (-not $itemId) { continue }
    $title = $issueTitles[$number]
    if (-not $title) { continue }
    $short = $title -replace '^\[M\d\]\s*', ''
    $spec = $specs[$short]
    if (-not $spec) { continue }

    if ($null -ne $spec.Phase) {
        $option = $faseField.options | Where-Object { $_.name -eq "M$($spec.Phase)" }
        if ($option) {
            $mutation = @"
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "$projectId", itemId: "$itemId", fieldId: "$($faseField.id)",
    value: { singleSelectOptionId: "$($option.id)" }
  }) { projectV2Item { id } }
}
"@
            Invoke-GraphQL $mutation | Out-Null
            Start-Sleep -Milliseconds ([int]($DelaySeconds * 1000))
        }
    }
    if ($spec.Effort) {
        $mutation = @"
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "$projectId", itemId: "$itemId", fieldId: "$($effortField.id)",
    value: { number: $($spec.Effort) }
  }) { projectV2Item { id } }
}
"@
        Invoke-GraphQL $mutation | Out-Null
        Start-Sleep -Milliseconds ([int]($DelaySeconds * 1000))
    }
    $updated++
    Write-Host "  · #$number M$($spec.Phase) · $($spec.Effort) d"
}
Write-Host "Elementos actualizados: $updated"
