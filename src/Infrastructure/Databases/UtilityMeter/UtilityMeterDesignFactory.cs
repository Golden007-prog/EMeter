namespace CleanMinimalApi.Infrastructure.Databases.UtilityMeter;

using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

internal sealed class UtilityMeterDesignFactory : IDesignTimeDbContextFactory<UtilityMeterDbContext>
{
    public UtilityMeterDbContext CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<UtilityMeterDbContext>()
        .UseNpgsql("Host=localhost;Database=utilitymeter;Username=utilitymeter;Password=design-only").Options);
}
