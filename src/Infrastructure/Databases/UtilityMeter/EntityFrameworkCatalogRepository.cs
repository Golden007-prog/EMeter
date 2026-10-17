namespace CleanMinimalApi.Infrastructure.Databases.UtilityMeter;

using Application.Catalog;
using Microsoft.EntityFrameworkCore;
internal sealed class EntityFrameworkCatalogRepository(UtilityMeterDbContext db) : ICatalogRepository
{
    public async Task<ICatalogWriteLock> LockPeriodAsync(Guid id, CancellationToken ct)
    {
        var transaction = db.Database.IsRelational() && db.Database.CurrentTransaction == null ? await db.Database.BeginTransactionAsync(ct) : null;
        try
        {
            if (db.Database.IsNpgsql())
            {
                await db.BillingPeriods.FromSqlInterpolated($"SELECT * FROM \"BillingPeriods\" WHERE \"Id\" = {id} FOR UPDATE").AsNoTracking().ToListAsync(ct);
            }
            return new WriteLock(transaction);
        }
        catch { if (transaction != null) await transaction.DisposeAsync(); throw; }
    }
    private sealed class WriteLock(Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? transaction) : ICatalogWriteLock
    {
        public Task CommitAsync(CancellationToken ct) => transaction?.CommitAsync(ct) ?? Task.CompletedTask;
        public ValueTask DisposeAsync() => transaction?.DisposeAsync() ?? ValueTask.CompletedTask;
    }
    public async Task<T?> FindAsync<T>(Guid id, CancellationToken ct) where T : class => await db.Set<T>().FindAsync([id], ct);
    public Task<List<T>> ListAsync<T>(CancellationToken ct) where T : class => db.Set<T>().AsNoTracking().OrderBy(x => EF.Property<Guid>(x, "Id")).ToListAsync(ct);
    public async Task<Application.Common.Page<T>> PageAsync<T>(System.Linq.Expressions.Expression<Func<T, bool>> predicate, int page, int pageSize, CancellationToken ct) where T : class
    {
        Application.Common.Paging.Validate(page, pageSize);
        var query = db.Set<T>().AsNoTracking().Where(predicate);
        var total = await query.CountAsync(ct);
        var items = await query.OrderBy(x => EF.Property<Guid>(x, "Id")).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new(items, page, pageSize, total);
    }
    public void Add<T>(T entity) where T : class => db.Add(entity);
    public async Task SaveAsync(CancellationToken ct) => await db.SaveChangesAsync(ct);
}
