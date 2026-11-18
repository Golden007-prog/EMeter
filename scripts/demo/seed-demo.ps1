<#
.SYNOPSIS
    Siembra datos de demostración en una API local de EMeter.

.DESCRIPTION
    Crea una organización, un condominio con medidor principal y dos submedidores, una
    propiedad de agua, cuatro meses de lecturas y un período de facturación de octubre.
    Sirve para revisar la interfaz, generar capturas para la wiki o probar reportes.

    La API debe estar en modo memoria (sin ConnectionStrings) o en un entorno desechable:
    el script agrega datos, no los reemplaza.

.EXAMPLE
    ./scripts/demo/seed-demo.ps1
    ./scripts/demo/seed-demo.ps1 -Base http://localhost:8080
#>
[CmdletBinding()]
param(
    [string]$Base = 'http://127.0.0.1:5032'
)

$ErrorActionPreference = 'Stop'

function New-Resource {
    param([string]$Path, [hashtable]$Body)
    $json = $Body | ConvertTo-Json -Depth 6 -Compress
    Invoke-RestMethod -Method Post -Uri "$Base/api/$Path" -ContentType 'application/json; charset=utf-8' -Body $json
}

function New-Reading {
    param([string]$MeterId, [string]$PropertyId, [double]$Value, [string]$Unit, [string]$MeasuredAt, [string]$PeriodId)
    $body = @{ meterId = $MeterId; propertyId = $PropertyId; value = $Value; unit = $Unit; measuredAt = $MeasuredAt; source = 'Resident' }
    if ($PeriodId) { $body.billingPeriodId = $PeriodId }
    New-Resource 'readings' $body
}

Write-Host "Sembrando datos en $Base"
$org = New-Resource 'organizations' @{ name = 'Comunidad Los Aromos'; contactEmail = 'administracion@losaromos.cl' }
$condo = New-Resource 'condominiums' @{ name = 'Edificio Los Aromos'; address = 'Av. Providencia 1234, Ñuñoa'; organizationId = $org.id }

$mainProperty = New-Resource 'properties' @{ name = 'Medidor general'; address = 'Av. Providencia 1234'; resourceType = 'Electricity'; organizationId = $org.id; condominiumId = $condo.id }
$dept101 = New-Resource 'properties' @{ name = 'Depto 101'; address = 'Av. Providencia 1234, piso 10'; resourceType = 'Electricity'; organizationId = $org.id; condominiumId = $condo.id }
$dept102 = New-Resource 'properties' @{ name = 'Depto 102'; address = 'Av. Providencia 1234, piso 10'; resourceType = 'Electricity'; organizationId = $org.id; condominiumId = $condo.id }
$waterProperty = New-Resource 'properties' @{ name = 'Depto 101 · Agua'; address = 'Av. Providencia 1234, piso 10'; resourceType = 'Water'; organizationId = $org.id }

$mainMeter = New-Resource 'meters' @{ propertyId = $mainProperty.id; serialNumber = 'EL-884201'; resourceType = 'Electricity'; unit = 'kWh'; model = 'Schneider iEM3155' }
$meter101 = New-Resource 'meters' @{ propertyId = $dept101.id; serialNumber = 'EL-771034'; resourceType = 'Electricity'; unit = 'kWh'; model = 'Carlo Gavazzi EM111' }
$meter102 = New-Resource 'meters' @{ propertyId = $dept102.id; serialNumber = 'EL-771035'; resourceType = 'Electricity'; unit = 'kWh'; model = 'Carlo Gavazzi EM111' }
$waterMeter = New-Resource 'meters' @{ propertyId = $waterProperty.id; serialNumber = 'AG-330871'; resourceType = 'Water'; unit = 'm³'; model = 'Itron Aquadis' }

Invoke-RestMethod -Method Put -Uri "$Base/api/condominiums/$($condo.id)/main-meter/$($mainMeter.id)" | Out-Null

$period = New-Resource 'billing-periods' @{ start = '2026-10-01T00:00:00-03:00'; end = '2026-11-01T00:00:00-03:00' }

# Historial: tres meses de base y el mes en trabajo. Depto 101 trae un salto anómalo a propósito.
$history = @(
    @{ Meter = $mainMeter.id; Property = $mainProperty.id; Values = @(46000, 46700, 47400, 48100); Unit = 'kWh' },
    @{ Meter = $meter101.id; Property = $dept101.id; Values = @(14800, 14950, 15080, 15600); Unit = 'kWh' },
    @{ Meter = $meter102.id; Property = $dept102.id; Values = @(9600, 9750, 9870, 10020); Unit = 'kWh' },
    @{ Meter = $waterMeter.id; Property = $waterProperty.id; Values = @(210, 224, 236, 251); Unit = 'm³' }
)
$dates = @('2026-07-01T10:00:00-04:00', '2026-08-01T10:00:00-04:00', '2026-09-01T10:00:00-04:00', '2026-10-01T10:00:00-03:00')

$october = @{}
foreach ($entry in $history) {
    for ($i = 0; $i -lt $dates.Count; $i++) {
        $inPeriod = if ($i -eq $dates.Count - 1) { $period.id } else { $null }
        $reading = New-Reading -MeterId $entry.Meter -PropertyId $entry.Property -Value $entry.Values[$i] -Unit $entry.Unit -MeasuredAt $dates[$i] -PeriodId $inPeriod
        # La respuesta de creación no siempre expone version; se relee para revisar con la versión vigente.
        if ($inPeriod) { $october[$entry.Meter] = Invoke-RestMethod "$Base/api/readings/$($reading.id)" }
    }
}

# Dos lecturas quedan pendientes de revisión; dos se confirman con motivo.
foreach ($confirmed in @($mainMeter.id, $meter102.id)) {
    $reading = $october[$confirmed]
    $body = @{ decision = 'Confirmed'; expectedVersion = $reading.version; reason = 'Verificado contra la fotografía del medidor' } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri "$Base/api/readings/$($reading.id)/review" -ContentType 'application/json; charset=utf-8' -Body $body | Out-Null
}

Write-Host ''
Write-Host 'Datos creados:'
Write-Host "  Organización : $($org.name)"
Write-Host "  Condominio   : $($condo.name)  ($($condo.id))"
Write-Host "  Período      : octubre 2026    ($($period.id))"
Write-Host '  Medidores    : principal EL-884201, Depto 101 EL-771034, Depto 102 EL-771035, agua AG-330871'
Write-Host '  Lecturas     : 16 (jul-2026 a oct-2026), 2 confirmadas y 2 pendientes'
Write-Host ''
Write-Host "Abre el cliente con VITE_API_BASE_URL=$Base y el período de octubre seleccionado."
