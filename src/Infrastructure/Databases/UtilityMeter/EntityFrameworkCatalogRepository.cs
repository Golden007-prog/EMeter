namespace CleanMinimalApi.Infrastructure.Databases.UtilityMeter;
using Application.Catalog;
using Microsoft.EntityFrameworkCore;
internal sealed class EntityFrameworkCatalogRepository(UtilityMeterDbContext db) : ICatalogRepository
{
    public async Task<T?> FindAsync<T>(Guid id, CancellationToken ct) where T : class => await db.Set<T>().FindAsync([id], ct);
    public Task<List<T>> ListAsync<T>(CancellationToken ct) where T : class => db.Set<T>().AsNoTracking().Take(1000).ToListAsync(ct);
    public void Add<T>(T entity) where T : class => db.Add(entity);
    public async Task SaveAsync(CancellationToken ct) => await db.SaveChangesAsync(ct);
}
