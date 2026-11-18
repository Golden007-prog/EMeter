<#
.SYNOPSIS
    Sincroniza el backlog versionado (docs/backlog/*.md) con GitHub:
    etiquetas, hitos, issues y campos del tablero de proyecto.

.DESCRIPTION
    Es idempotente: no duplica etiquetas, hitos, issues ni elementos del tablero.
    Los issues de la fase 0 se crean cerrados porque documentan trabajo ya realizado.

.EXAMPLE
    ./scripts/github/sync.ps1
    ./scripts/github/sync.ps1 -Owner cbinput -Repo EMeter -SkipProject
#>
[CmdletBinding()]
param(
    [string]$Owner = 'cbinput',
    [string]$Repo = 'EMeter',
    [string]$ProjectTitle = 'EMeter · Roadmap',
    [switch]$SkipProject,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$utf8 = New-Object System.Text.UTF8Encoding($false)

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$backlogDir = Join-Path $repoRoot 'docs/backlog'
if (-not (Test-Path $backlogDir)) { throw "No existe $backlogDir" }

# --------------------------------------------------------------------------- etiquetas
$labels = @(
    @{ Name = 'type:story'; Color = '1D76DB'; Description = 'Capacidad nueva contada desde quien la usa' },
    @{ Name = 'type:task'; Color = '5319E7'; Description = 'Trabajo técnico sin cambio visible' },
    @{ Name = 'type:bug'; Color = 'D73A4A'; Description = 'Comportamiento incorrecto' },
    @{ Name = 'type:spike'; Color = 'FBCA04'; Description = 'Investigación con entregable y fecha' },
    @{ Name = 'area:api'; Color = '0052CC'; Description = 'Backend .NET' },
    @{ Name = 'area:web'; Color = '0E8A16'; Description = 'Cliente React' },
    @{ Name = 'area:ocr'; Color = 'B60205'; Description = 'Extracción de boletas' },
    @{ Name = 'area:data'; Color = '6E2594'; Description = 'Modelo y persistencia' },
    @{ Name = 'area:infra'; Color = '333333'; Description = 'CI, contenedores y despliegue' },
    @{ Name = 'area:docs'; Color = '0075CA'; Description = 'Documentación y decisiones' },
    @{ Name = 'area:security'; Color = '8B0000'; Description = 'Identidad, aislamiento y protección de datos' },
    @{ Name = 'prio:alta'; Color = 'B60205'; Description = 'Bloquea el objetivo del producto' },
    @{ Name = 'prio:media'; Color = 'FBCA04'; Description = 'Importante, no bloqueante' },
    @{ Name = 'prio:baja'; Color = 'C2E0C6'; Description = 'Mejora deseable' },
    @{ Name = 'status:needs-triage'; Color = 'EDEDED'; Description = 'Sin revisar' },
    @{ Name = 'status:ready'; Color = '0E8A16'; Description = 'Listo para implementar' },
    @{ Name = 'status:blocked'; Color = 'D73A4A'; Description = 'Bloqueado por otra tarea o decisión' }
)
for ($fase = 0; $fase -le 7; $fase++) {
    $labels += @{ Name = "fase:$fase"; Color = 'BFD4F2'; Description = "Fase $fase del roadmap" }
}
foreach ($label in $labels) {
    gh label create $label.Name --repo "$Owner/$Repo" --color $label.Color --description $label.Description --force 2>$null | Out-Null
}
Write-Host "Etiquetas: $($labels.Count) sincronizadas."

# --------------------------------------------------------------------------- hitos
$milestones = @(
    @{ Title = 'M0 · Fundación del monorepo'; Due = '2026-11-17'; Description = 'Repositorio único, CI, documentación y tablero.' },
    @{ Title = 'M1 · Números confiables'; Due = '2026-12-18'; Description = 'Que ninguna cifra se lea como un dato que no es.' },
    @{ Title = 'M2 · La boleta como dato'; Due = '2027-01-15'; Description = 'Persistir boleta, cargos y su evidencia.' },
    @{ Title = 'M3 · Tarifas oficiales'; Due = '2027-02-05'; Description = 'Precio oficial vigente por proveedor y comuna.' },
    @{ Title = 'M4 · Auditoría automática'; Due = '2027-03-12'; Description = 'Reglas que detectan sobrecobro con monto explicable.' },
    @{ Title = 'M5 · Reclamo y evidencia'; Due = '2027-04-02'; Description = 'Expediente presentable y seguimiento del reclamo.' },
    @{ Title = 'M6 · Producto seguro'; Due = '2027-04-30'; Description = 'Identidad, aislamiento de datos y operación.' },
    @{ Title = 'M7 · Cobertura OCR y móvil'; Due = '2027-05-21'; Description = 'Calidad medida y captura desde el teléfono.' }
)

$existingMilestones = @{}
(gh api "repos/$Owner/$Repo/milestones?state=all&per_page=100" | ConvertFrom-Json) | ForEach-Object {
    $existingMilestones[$_.title] = $_.number
}
foreach ($milestone in $milestones) {
    if ($existingMilestones.ContainsKey($milestone.Title)) { continue }
    gh api -X POST "repos/$Owner/$Repo/milestones" -f "title=$($milestone.Title)" -f "description=$($milestone.Description)" -f "due_on=$($milestone.Due)T00:00:00Z" | Out-Null
    Write-Host "  + hito $($milestone.Title)"
}
Write-Host "Hitos: $($milestones.Count) verificados."

# --------------------------------------------------------------------------- parseo del backlog
function Read-BacklogItem {
    param([string]$Path)
    $content = Get-Content $Path -Raw
    $sections = [regex]::Split($content, '(?m)^## ') | Select-Object -Skip 1
    foreach ($section in $sections) {
        $lines = @($section -split "`r?`n")
        if ($lines.Count -lt 1) { continue }
        $title = $lines[0].Trim()
        if ([string]::IsNullOrWhiteSpace($title)) { continue }

        $labelsToApply = @()
        $effort = $null
        $milestoneTitle = $null
        $bodyStart = $lines.Count
        for ($i = 1; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            if ($line -match '^labels:\s*(.+)$') { $labelsToApply = @($matches[1] -split ',' | ForEach-Object { $_.Trim() }); continue }
            if ($line -match '^effort:\s*(\d+)$') { $effort = [int]$matches[1]; continue }
            if ($line -match '^milestone:\s*(.+)$') { $milestoneTitle = $matches[1].Trim(); continue }
            if ([string]::IsNullOrWhiteSpace($line)) { $bodyStart = $i + 1; break }
        }
        $body = (@($lines[$bodyStart..($lines.Count - 1)]) -join "`n").Trim()
        if ($effort) { $body = "$body`n`n---`n**Esfuerzo estimado:** $effort día(s) de una persona." }

        [pscustomobject]@{
            Title     = $title
            Labels    = $labelsToApply
            Effort    = $effort
            Milestone = $milestoneTitle
            Body      = $body
            Phase     = if ($title -match '^\[M(\d)\]') { [int]$matches[1] } else { $null }
        }
    }
}

$items = @()
foreach ($file in (Get-ChildItem $backlogDir -Filter '*.md' | Sort-Object Name)) {
    $items += Read-BacklogItem -Path $file.FullName
}
Write-Host "Backlog: $($items.Count) elementos definidos."
if ($DryRun) {
    $items | Select-Object Phase, Effort, Milestone, Title, @{ N = 'Labels'; E = { $_.Labels -join ', ' } }, @{ N = 'BodyChars'; E = { $_.Body.Length } } |
        Format-Table -AutoSize -Wrap
    return
}

# --------------------------------------------------------------------------- issues
# REST en lugar de GraphQL: `gh issue list/create` consumen la cuota de GraphQL y, cuando se
# agota, el script confundiría «no existe» con «no pude preguntar».
function Get-AllIssues {
    $all = @()
    for ($page = 1; $page -le 10; $page++) {
        $batch = gh api "repos/$Owner/$Repo/issues?state=all&per_page=100&page=$page" | ConvertFrom-Json
        $batch = @($batch | Where-Object { -not $_.pull_request })
        if ($batch.Count -eq 0) { break }
        $all += $batch
        if ($batch.Count -lt 100) { break }
    }
    $all
}

$milestoneNumbers = @{}
foreach ($key in $existingMilestones.Keys) { $milestoneNumbers[$key] = $existingMilestones[$key] }
(gh api "repos/$Owner/$Repo/milestones?state=all&per_page=100" | ConvertFrom-Json) | ForEach-Object {
    $milestoneNumbers[$_.title] = $_.number
}

$existingTitles = @{}
foreach ($issue in (Get-AllIssues)) { $existingTitles[$issue.title] = $true }

$created = 0
foreach ($item in $items) {
    if ($existingTitles.ContainsKey($item.Title)) {
        Write-Host "  = $($item.Title)"
        continue
    }
    $payload = @{ title = $item.Title; body = $item.Body }
    if ($item.Milestone -and $milestoneNumbers.ContainsKey($item.Milestone)) {
        $payload.milestone = $milestoneNumbers[$item.Milestone]
    }
    if ($item.Labels.Count -gt 0) { $payload.labels = @($item.Labels) }
    $json = $payload | ConvertTo-Json -Depth 4 -Compress
    $result = ($json | gh api -X POST "repos/$Owner/$Repo/issues" --input - | Out-String) | ConvertFrom-Json
    if (-not $result.number) { throw "No se pudo crear el issue: $($item.Title)" }
    if ($item.Phase -eq 0) {
        gh api -X PATCH "repos/$Owner/$Repo/issues/$($result.number)" -f state='closed' -f state_reason='completed' | Out-Null
    }
    $created++
    Write-Host "  + #$($result.number) $($item.Title)"
}
Write-Host "Issues creados: $created."

# --------------------------------------------------------------------------- tablero
if ($SkipProject) { return }

function Invoke-GhWithRetry {
    param([string[]]$Arguments, [int]$Retries = 5)
    for ($attempt = 0; $attempt -lt $Retries; $attempt++) {
        $output = & gh @Arguments 2>&1
        if ($LASTEXITCODE -eq 0) { return $output }
        $text = ($output | Out-String)
        if ($text -match 'rate limit|secondary rate') {
            $wait = 15 * ($attempt + 1)
            Write-Host "    … límite de API, esperando $wait s"
            Start-Sleep -Seconds $wait
            continue
        }
        throw "gh $($Arguments -join ' ') falló: $text"
    }
    throw "gh $($Arguments -join ' ') agotó reintentos"
}

$projects = (Invoke-GhWithRetry @('project', 'list', '--owner', $Owner, '--format', 'json', '--limit', '50') | ConvertFrom-Json).projects
$project = $projects | Where-Object { $_.title -eq $ProjectTitle } | Select-Object -First 1
$projectNumber = if ($project) { [int]$project.number } else { 0 }
if (-not $projectNumber) {
    $projectNumber = [int](Invoke-GhWithRetry @('project', 'create', '--owner', $Owner, '--title', $ProjectTitle, '--format', 'json') | ConvertFrom-Json).number
    Write-Host "Tablero #$projectNumber creado."
}

$fieldNames = (Invoke-GhWithRetry @('project', 'field-list', "$projectNumber", '--owner', $Owner, '--format', 'json') | ConvertFrom-Json).fields |
    ForEach-Object { $_.name }
if ($fieldNames -notcontains 'Fase') {
    Invoke-GhWithRetry @('project', 'field-create', "$projectNumber", '--owner', $Owner, '--name', 'Fase', '--data-type', 'SINGLE_SELECT', '--single-select-options', 'M0,M1,M2,M3,M4,M5,M6,M7') | Out-Null
}
if ($fieldNames -notcontains 'Esfuerzo (días)') {
    Invoke-GhWithRetry @('project', 'field-create', "$projectNumber", '--owner', $Owner, '--name', 'Esfuerzo (días)', '--data-type', 'NUMBER') | Out-Null
}

$issues = (gh issue list --repo "$Owner/$Repo" --state all --limit 400 --json number,title,url,labels) | ConvertFrom-Json
$itemsInProject = ((Invoke-GhWithRetry @('project', 'item-list', "$projectNumber", '--owner', $Owner, '--format', 'json', '--limit', '400')) | ConvertFrom-Json).items
$tracked = @{}
foreach ($entry in $itemsInProject) { if ($entry.content.number) { $tracked[[int]$entry.content.number] = $true } }

$byTitle = @{}
foreach ($item in $items) { $byTitle[$item.Title] = $item }

foreach ($issue in $issues) {
    if (-not $tracked.ContainsKey($issue.number)) {
        Invoke-GhWithRetry @('project', 'item-add', "$projectNumber", '--owner', $Owner, '--url', $issue.url) | Out-Null
        Start-Sleep -Milliseconds 400
        Write-Host "  + tablero #$($issue.number)"
    }
    $spec = $byTitle[$issue.title]
    if (-not $spec) { continue }
    if ($null -ne $spec.Phase) {
        Invoke-GhWithRetry @('project', 'item-edit', "$projectNumber", '--owner', $Owner, '--url', $issue.url, '--field', 'Fase', '--value', "M$($spec.Phase)") | Out-Null
        Start-Sleep -Milliseconds 300
    }
    if ($spec.Effort) {
        Invoke-GhWithRetry @('project', 'item-edit', "$projectNumber", '--owner', $Owner, '--url', $issue.url, '--field', 'Esfuerzo (días)', '--number', "$($spec.Effort)") | Out-Null
        Start-Sleep -Milliseconds 300
    }
}
Write-Host "Tablero #$projectNumber sincronizado con $($issues.Count) issues."
