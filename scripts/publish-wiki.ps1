<#
.SYNOPSIS
    Publica docs/wiki/*.md en la wiki de GitHub del repositorio.

.DESCRIPTION
    La wiki de GitHub no tiene API: es un repositorio git aparte. Este script lo clona, copia
    las páginas y hace commit. Si la wiki nunca se abrió, GitHub todavía no creó el repositorio
    y el script lo explica.

.EXAMPLE
    ./scripts/publish-wiki.ps1
#>
[CmdletBinding()]
param(
    [string]$Owner = 'cbinput',
    [string]$Repo = 'EMeter',
    [string]$Message = 'docs(wiki): actualizar páginas desde docs/wiki'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $repoRoot 'docs/wiki'
if (-not (Test-Path $sourceDir)) { throw "No existe $sourceDir" }

$workDir = Join-Path ([System.IO.Path]::GetTempPath()) ("emeter-wiki-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
$cloneUrl = "https://github.com/$Owner/$Repo.wiki.git"

git clone $cloneUrl $workDir 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $workDir '.git'))) {
    throw @"
La wiki todavía no existe en GitHub: GitHub crea el repositorio de la wiki al guardar la
primera página desde la interfaz.

Un paso manual (10 segundos):
  1. Abre https://github.com/$Owner/$Repo/wiki
  2. Pulsa "Create the first page" y guarda cualquier texto.
  3. Vuelve a ejecutar este script; las páginas de docs/wiki se publican y esa página se
     reemplaza por Home.md.
"@
}

Copy-Item (Join-Path $sourceDir '*.md') $workDir -Force
$imagesSource = Join-Path $sourceDir 'images'
if (Test-Path $imagesSource) {
    $imagesTarget = Join-Path $workDir 'images'
    New-Item -ItemType Directory -Path $imagesTarget -Force | Out-Null
    Copy-Item (Join-Path $imagesSource '*') $imagesTarget -Force
    Write-Host "Imágenes copiadas: $((Get-ChildItem $imagesTarget -File | Measure-Object).Count)"
}
Push-Location $workDir
try {
    git add -A
    $status = git status --porcelain
    if (-not $status) { Write-Host 'La wiki ya estaba al día.'; return }
    git -c user.name='Sebastian' -c user.email='sebastian@localhost' commit -q -m $Message
    git push origin HEAD 2>&1 | Select-Object -Last 2
    Write-Host "Wiki publicada: https://github.com/$Owner/$Repo/wiki"
}
finally {
    Pop-Location
    Remove-Item $workDir -Recurse -Force -ErrorAction SilentlyContinue
}
