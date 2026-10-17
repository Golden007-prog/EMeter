namespace CleanMinimalApi.Infrastructure;

using System;
using Microsoft.Extensions.Configuration;
using Minio;
using Application.Extraction;
using Infrastructure.Extraction;
using Application.BackgroundJobs;
using Application.Evidence;
using Application.Readings;
using Application.Reports;
using Application.Storage;
using Databases.UtilityMeter;
using Infrastructure.BackgroundJobs;
using Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration? configuration = null)
    {
        var connection = configuration?.GetConnectionString("UtilityMeter");
        var memoryName = $"UtilityMeter-{Guid.NewGuid()}";
        services.AddDbContext<UtilityMeterDbContext>(options =>
        {
            if (string.IsNullOrWhiteSpace(connection)) options.UseInMemoryDatabase(memoryName);
            else options.UseNpgsql(connection);
        });
        services.AddScoped<Application.Catalog.ICatalogRepository, EntityFrameworkCatalogRepository>();
        services.AddScoped<IReadingsRepository, EntityFrameworkReadingsRepository>();
        services.AddScoped<IEvidenceRepository, EntityFrameworkEvidenceRepository>();
        services.AddScoped<ICondominiumReconciliationRepository, EntityFrameworkCondominiumReconciliationRepository>();
        services.AddScoped<IExtractionJobs, PostgresExtractionJobs>();
        services.AddSingleton<IBackgroundJobQueue, InMemoryBackgroundJobQueue>();
        if (configuration?["Storage:Endpoint"] is { Length: > 0 } endpoint)
        {
            var client = new MinioClient().WithEndpoint(endpoint)
                .WithCredentials(configuration["Storage:AccessKey"], configuration["Storage:SecretKey"])
                .WithSSL(configuration.GetValue<bool>("Storage:UseSsl")).Build();
            services.AddSingleton<IMinioClient>(client);
            services.AddSingleton<IObjectStorage>(new MinioObjectStorage(client, configuration["Storage:Bucket"] ?? "evidence"));
        }
        else services.AddSingleton<IObjectStorage, InMemoryObjectStorage>();
        services.AddHttpClient<IMeterReadingExtractor, HttpMeterReadingExtractor>(client =>
        {
            client.BaseAddress = new Uri(configuration?["Ocr:BaseUrl"] ?? "http://localhost:8090/");
            client.Timeout = TimeSpan.FromMinutes(5);
        });
        _ = services.AddSingleton(TimeProvider.System);

        return services;
    }
}
