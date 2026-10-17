namespace CleanMinimalApi.Infrastructure;

using Databases.UtilityMeter;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Minio;
using Minio.DataModel.Args;

public static class InfrastructureInitialization
{
    public static async Task InitializeInfrastructureAsync(this IServiceProvider provider, CancellationToken cancellationToken = default)
    {
        using var scope = provider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<UtilityMeterDbContext>();
        if (db.Database.IsNpgsql()) await db.Database.MigrateAsync(cancellationToken);
        if (provider.GetService<IMinioClient>() is { } minio)
        {
            var bucket = provider.GetRequiredService<IConfiguration>()["Storage:Bucket"] ?? "evidence";
            if (!await minio.BucketExistsAsync(new BucketExistsArgs().WithBucket(bucket), cancellationToken))
                await minio.MakeBucketAsync(new MakeBucketArgs().WithBucket(bucket), cancellationToken);
        }
    }
}
