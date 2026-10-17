namespace CleanMinimalApi.Presentation.Tests.Integration.Endpoints;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Catalog;
using Application.Common;
using Application.Readings.Dtos;
using Application.Readings;
using Shouldly;
using Xunit;

public class WorkflowEndpointTests
{
    private static async Task<T> Post<T>(HttpClient client, string path, object body)
    {
        using var response = await client.PostAsJsonAsync(path, body);
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, text);
        return JsonSerializer.Deserialize<T>(text, WorkflowJson.Options)!;
    }
    private static async Task<(Guid Meter, Guid Property)> Setup(HttpClient client)
    {
        var property = await Post<PropertyDto>(client, "/api/properties", new { name = "Casa", address = "Santiago", resourceType = "water" });
        var meter = await Post<MeterDto>(client, "/api/meters", new { propertyId = property.Id, serialNumber = "A-123", resourceType = "water", unit = "m3", model = "test" });
        return (meter.Id, property.Id);
    }
    private static object Reading(Guid meter, decimal value, int day, Guid? requestId = null, Guid? billingPeriodId = null) =>
        new { meterId = meter, value, unit = "m3", measuredAt = $"2026-10-{day:00}T12:00:00-03:00", source = "Resident", requestId, billingPeriodId };
    private static async Task<ReadingDto> GetReading(HttpClient client, Guid id) => (await client.GetForTest<ReadingDto>($"/api/readings/{id}"))!;

    [Fact]
    public async Task LateReadingsCorrectionsReviewsAndVoidsRebuildTheTimelineAndKeepHistory()
    {
        using var app = new CleanMinimalApiApplication();
        using var client = app.CreateClient();
        var (meter, _) = await Setup(client);
        var first = await Post<JsonElement>(client, "/api/readings", Reading(meter, 100, 1));
        var last = await Post<JsonElement>(client, "/api/readings", Reading(meter, 160, 3));
        var middle = await Post<JsonElement>(client, "/api/readings", Reading(meter, 125, 2));
        var firstId = first.GetProperty("id").GetGuid();
        var lastId = last.GetProperty("id").GetGuid();
        var middleId = middle.GetProperty("id").GetGuid();
        (await GetReading(client, lastId)).PreviousReadingId.ShouldBe(middleId);
        var current = await GetReading(client, middleId);
        var confirmed = await Post<ReadingDto>(client, $"/api/readings/{middleId}/review", new { decision = "Confirmed", expectedVersion = current.Version, reason = "Verified against photo" });
        confirmed.ReviewStatus.ShouldBe("Confirmed");
        using var stale = await client.PutAsJsonAsync($"/api/readings/{middleId}", new { value = 130, measuredAt = current.MeasuredAt, expectedVersion = current.Version, reason = "Correct typo" });
        stale.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        using var corrected = await client.PutAsJsonAsync($"/api/readings/{middleId}", new { value = 130, measuredAt = current.MeasuredAt, expectedVersion = confirmed.Version, reason = "Correct typo" });
        corrected.EnsureSuccessStatusCode();
        var updated = (await corrected.Content.ReadForTest<ReadingDto>())!;
        updated.ReviewStatus.ShouldBe("Pending");
        await Post<ReadingDto>(client, $"/api/readings/{middleId}/void", new { expectedVersion = updated.Version, reason = "Duplicate document" });
        (await GetReading(client, lastId)).PreviousReadingId.ShouldBe(firstId);
        var history = (await client.GetForTest<Page<ReadingRevisionDto>>($"/api/readings/{middleId}/history"))!;
        history.Items.Select(x => x.Action).ShouldContain("Corrected");
        history.Items.Select(x => x.Action).ShouldContain("Voided");
        history.Items.Single(x => x.Action == "Corrected").BeforeJson!.ShouldContain("125");
    }

    [Fact]
    public async Task RequestIdsAvoidDuplicateSubmissionsAndRejectDifferentPayloads()
    {
        using var app = new CleanMinimalApiApplication();
        using var client = app.CreateClient();
        var (meter, _) = await Setup(client);
        var key = Guid.NewGuid();
        var one = await Post<JsonElement>(client, "/api/readings", Reading(meter, 100, 1, key));
        var two = await Post<JsonElement>(client, "/api/readings", Reading(meter, 100, 1, key));
        one.GetProperty("id").GetGuid().ShouldBe(two.GetProperty("id").GetGuid());
        using var conflict = await client.PostAsJsonAsync("/api/readings", Reading(meter, 101, 1, key));
        conflict.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        using var duplicate = await client.PostAsJsonAsync("/api/readings", Reading(meter, 100, 1));
        duplicate.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RejectionRestoresMissingReadingAndClosedPeriodsRejectEditsAndLateInserts()
    {
        using var app = new CleanMinimalApiApplication();
        using var client = app.CreateClient();
        var (meter, _) = await Setup(client);
        var period = await Post<BillingPeriodDto>(client, "/api/billing-periods", new { start = "2026-10-01T00:00:00-03:00", end = "2026-11-01T00:00:00-03:00" });
        var r = await Post<JsonElement>(client, "/api/readings", Reading(meter, 100, 2, billingPeriodId: period.Id));
        var id = r.GetProperty("id").GetGuid();
        var reading = await GetReading(client, id);
        var rejected = await Post<ReadingDto>(client, $"/api/readings/{id}/review", new { decision = "Rejected", expectedVersion = reading.Version, reason = "Wrong meter" });
        var missing = (await client.GetForTest<List<JsonElement>>($"/api/reports/missing-readings/{period.Id}"))!;
        missing.Any(x => x.GetProperty("meterId").GetGuid() == meter).ShouldBeTrue();
        await Post<ReadingDto>(client, $"/api/readings/{id}/review", new { decision = "Confirmed", expectedVersion = rejected.Version, reason = "Meter checked" });
        using var closed = await client.PutAsync($"/api/billing-periods/{period.Id}/status/Closed", null);
        closed.EnsureSuccessStatusCode();
        reading = await GetReading(client, id);
        using var edit = await client.PutAsJsonAsync($"/api/readings/{id}", new { value = 101, measuredAt = reading.MeasuredAt, billingPeriodId = period.Id, expectedVersion = reading.Version, reason = "Correction" });
        edit.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        // Even a baseline outside the period must not recalculate a closed reading.
        using var late = await client.PostAsJsonAsync("/api/readings", Reading(meter, 90, 1));
        late.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await client.GetForTest<List<ReadingDto>>($"/api/readings/meter/{meter}"))!.Count.ShouldBe(1);
    }

    [Fact]
    public async Task CatalogsExposeDetailsFiltersPaginationAndEditableMetadata()
    {
        using var app = new CleanMinimalApiApplication();
        using var client = app.CreateClient();
        var org = await Post<OrganizationDto>(client, "/api/organizations", new { name = "Community", contactEmail = "test@example.com" });
        var condo = await Post<CondominiumDto>(client, "/api/condominiums", new { name = "Condo", address = "Street 1", organizationId = org.Id });
        var prop = await Post<PropertyDto>(client, "/api/properties", new { name = "House", address = "Street 2", resourceType = "water", condominiumId = condo.Id });
        var meter = await Post<MeterDto>(client, "/api/meters", new { propertyId = prop.Id, serialNumber = "main", resourceType = "water", unit = "m3", model = "M1" });
        using var assigned = await client.PutAsync($"/api/condominiums/{condo.Id}/main-meter/{meter.Id}", null);
        assigned.EnsureSuccessStatusCode();
        (await client.GetForTest<CondominiumDto>($"/api/condominiums/{condo.Id}"))!.MainMeterId.ShouldBe(meter.Id);
        prop.OrganizationId.ShouldBe(org.Id);
        prop.CondominiumId.ShouldBe(condo.Id);
        prop.Address.ShouldBe("Street 2");
        meter.Model.ShouldBe("M1");
        await Post<OrganizationDto>(client, "/api/organizations", new { name = "Second" });
        var page = (await client.GetForTest<Page<OrganizationDto>>("/api/organizations?pageSize=1"))!;
        page.TotalCount.ShouldBe(2);
        page.HasNextPage.ShouldBeTrue();
        var filtered = (await client.GetForTest<Page<PropertyDto>>($"/api/properties?organizationId={org.Id}&search=house"))!;
        filtered.Items.Single().Id.ShouldBe(prop.Id);
        using var updated = await client.PutAsJsonAsync($"/api/properties/{prop.Id}", new { name = "House 2", address = "Street 3" });
        updated.EnsureSuccessStatusCode();
        (await updated.Content.ReadForTest<PropertyDto>())!.Address.ShouldBe("Street 3");
        using var invalid = await client.GetAsync("/api/meters?pageSize=201");
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CorsErrorsAndOpenApiMatchTheWireContracts()
    {
        using var app = new CleanMinimalApiApplication();
        using var client = app.CreateClient();
        using var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/readings");
        preflight.Headers.Add("Origin", "http://localhost:5173");
        preflight.Headers.Add("Access-Control-Request-Method", "POST");
        preflight.Headers.Add("Access-Control-Request-Headers", "content-type");
        using var allowed = await client.SendAsync(preflight);
        allowed.Headers.GetValues("Access-Control-Allow-Origin").Single().ShouldBe("http://localhost:5173");
        using var deniedRequest = new HttpRequestMessage(HttpMethod.Get, "/api/meters");
        deniedRequest.Headers.Add("Origin", "https://untrusted.example");
        using var denied = await client.SendAsync(deniedRequest);
        denied.Headers.Contains("Access-Control-Allow-Origin").ShouldBeFalse();
        using var missing = await client.GetAsync($"/api/readings/{Guid.NewGuid()}");
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        missing.Content.Headers.ContentType!.MediaType.ShouldBe("application/problem+json");
        using var malformed = await client.PostAsync("/api/readings", new StringContent("{", System.Text.Encoding.UTF8, "application/json"));
        malformed.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        malformed.Content.Headers.ContentType!.MediaType.ShouldBe("application/problem+json");
        using var incomplete = await client.PostAsJsonAsync("/api/readings", new { meterId = Guid.NewGuid(), unit = "m3", measuredAt = "2026-10-01T00:00:00Z" });
        incomplete.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var spec = (await client.GetForTest<JsonElement>("/openapi/v1.json"));
        var schemas = spec.GetProperty("components").GetProperty("schemas");
        var required = schemas.GetProperty("ConfirmExtractionRequest").GetProperty("required").EnumerateArray().Select(x => x.GetString()).ToList();
        required.ShouldNotContain("id");
        required.ShouldNotContain("propertyId");
        required.ShouldContain("meterId");
        var nullable = await Post<JsonElement>(client, "/api/organizations", new { name = "No email" });
        nullable.GetProperty("contactEmail").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task OcrUploadsCanBeRecoveredFromTheServerInbox()
    {
        using var app = new CleanMinimalApiApplication();
        using var client = app.CreateClient();
        using var form = new MultipartFormDataContent();
        var file = new ByteArrayContent("%PDF-1.4\nprototype"u8.ToArray());
        file.Headers.ContentType = new("application/pdf");
        form.Add(file, "file", "bill.pdf");
        using var upload = await client.PostAsync("/api/evidence/upload", form);
        upload.StatusCode.ShouldBe(HttpStatusCode.Accepted);
        var evidence = (await upload.Content.ReadForTest<JsonElement>());
        var id = evidence.GetProperty("extractionId").GetGuid();
        upload.Headers.Location!.ToString().ShouldBe($"/api/extractions/{id}");
        var inbox = (await client.GetForTest<Page<Application.Extraction.ExtractionListItem>>("/api/extractions?status=Queued"))!;
        inbox.Items.Single().Id.ShouldBe(id);
        inbox.Items.Single().FileName.ShouldBe("bill.pdf");
        using var retry = await client.PostAsync($"/api/extractions/{id}/retry", null);
        retry.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        using var missing = await client.PostAsync($"/api/extractions/{Guid.NewGuid()}/retry", null);
        missing.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}

internal static class WorkflowJson
{
    public static readonly JsonSerializerOptions Options = CreateOptions();
    private static JsonSerializerOptions CreateOptions()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        return options;
    }
    public static Task<T?> GetForTest<T>(this HttpClient client, string uri) => client.GetFromJsonAsync<T>(uri, Options);
    public static Task<T?> ReadForTest<T>(this HttpContent content) => content.ReadFromJsonAsync<T>(Options);
}
