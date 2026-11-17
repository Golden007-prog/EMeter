namespace CleanMinimalApi.Presentation.Serialization;

using System.Text.Json.Serialization;
using Application.Evidence.Commands.AttachEvidenceToReading;
using Application.Evidence.Commands.UploadEvidence;
using Application.Evidence.Dtos;
using Application.Readings.Commands.CreateReading;
using Application.Readings.Dtos;
using Application.Reports.Dtos;
using Application.Versions.Entities;
using Endpoints;
using Requests;

/// <summary>
/// JSON serialization context for compile-time source generation.
/// Provides performance benefits and AOT (Ahead-of-Time) compilation support.
/// </summary>
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    PropertyNameCaseInsensitive = true,
    RespectRequiredConstructorParameters = true,
    WriteIndented = false,
    GenerationMode = JsonSourceGenerationMode.Default)]
[JsonSerializable(typeof(Application.Extraction.ExtractionJob))]
[JsonSerializable(typeof(Application.Extraction.ExtractionStatus))]
[JsonSerializable(typeof(Application.Extraction.ConfirmExtractionCommand))]
[JsonSerializable(typeof(Application.Extraction.CreateConfirmation))]
[JsonSerializable(typeof(CondominiumReconciliationDto))]
[JsonSerializable(typeof(Application.Catalog.CatalogItem))]
[JsonSerializable(typeof(List<Application.Catalog.CatalogItem>))]
[JsonSerializable(typeof(Application.Catalog.CreateOrganization))]
[JsonSerializable(typeof(Application.Catalog.CreateCondominium))]
[JsonSerializable(typeof(Application.Catalog.CreateProperty))]
[JsonSerializable(typeof(Application.Catalog.CreateMeter))]
[JsonSerializable(typeof(Application.Catalog.CreateBillingPeriod))]
[JsonSerializable(typeof(List<Application.Reports.Queries.GetPendingReadings.MissingReadingDto>))]
[JsonSerializable(typeof(Version))]
[JsonSerializable(typeof(List<Version>))]
[JsonSerializable(typeof(CreateReadingRequest))]
[JsonSerializable(typeof(CreateReadingResponse))]
[JsonSerializable(typeof(ReadingDto))]
[JsonSerializable(typeof(List<ReadingDto>))]
[JsonSerializable(typeof(PendingReadingDto))]
[JsonSerializable(typeof(List<PendingReadingDto>))]
[JsonSerializable(typeof(AbnormalReadingDto))]
[JsonSerializable(typeof(List<AbnormalReadingDto>))]
[JsonSerializable(typeof(MonthlySummaryDto))]
[JsonSerializable(typeof(UploadEvidenceResponse))]
[JsonSerializable(typeof(AttachEvidenceRequest))]
[JsonSerializable(typeof(AttachEvidenceToReadingResponse))]
[JsonSerializable(typeof(EvidenceDto))]
[JsonSerializable(typeof(List<EvidenceDto>))]
[JsonSerializable(typeof(Application.Catalog.OrganizationDto))]
[JsonSerializable(typeof(Application.Common.Page<Application.Catalog.OrganizationDto>))]
[JsonSerializable(typeof(Application.Catalog.CondominiumDto))]
[JsonSerializable(typeof(Application.Common.Page<Application.Catalog.CondominiumDto>))]
[JsonSerializable(typeof(Application.Catalog.PropertyDto))]
[JsonSerializable(typeof(Application.Common.Page<Application.Catalog.PropertyDto>))]
[JsonSerializable(typeof(Application.Catalog.MeterDto))]
[JsonSerializable(typeof(Application.Common.Page<Application.Catalog.MeterDto>))]
[JsonSerializable(typeof(Application.Catalog.BillingPeriodDto))]
[JsonSerializable(typeof(Application.Common.Page<Application.Catalog.BillingPeriodDto>))]
[JsonSerializable(typeof(Application.Catalog.UpdateOrganization))]
[JsonSerializable(typeof(Application.Catalog.UpdateAddress))]
[JsonSerializable(typeof(Application.Catalog.UpdateMeter))]
[JsonSerializable(typeof(Application.Catalog.UpdateBillingPeriod))]
[JsonSerializable(typeof(Application.Readings.UpdateReadingRequest))]
[JsonSerializable(typeof(Application.Readings.ReviewReadingRequest))]
[JsonSerializable(typeof(Application.Readings.VoidReadingRequest))]
[JsonSerializable(typeof(Application.Common.Page<Application.Readings.ReadingRevisionDto>))]
[JsonSerializable(typeof(Application.Common.Page<Application.Extraction.ExtractionListItem>))]
[JsonSerializable(typeof(Application.Extraction.ConfirmExtractionRequest))]
public partial class AppJsonSerializerContext : JsonSerializerContext
{
}
