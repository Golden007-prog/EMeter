namespace CleanMinimalApi.Infrastructure.Extraction;

using Application.Extraction;
using System.Net.Http.Json;

internal sealed class HttpMeterReadingExtractor(HttpClient client) : IMeterReadingExtractor
{
    public async Task<ExtractedBill> ExtractAsync(Stream content, string fileName, string contentType, CancellationToken ct)
    {
        using var form = new MultipartFormDataContent();
        var file = new StreamContent(content);
        file.Headers.ContentType = new(contentType);
        form.Add(file, "file", fileName);
        using var response = await client.PostAsync("extract", form, ct);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<ExtractedBill>(ct) ?? throw new InvalidOperationException("Empty OCR result");
    }
}
