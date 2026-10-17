namespace CleanMinimalApi.Infrastructure.Databases.UtilityMeter;

using System.Reflection;
using Application.BillingPeriods.Entities;
using Application.Condominiums.Entities;
using Application.Evidence.Entities;
using Application.Meters.Entities;
using Application.Organizations.Entities;
using Application.Properties.Entities;
using Application.Readings.Entities;
using Application.Reports;
using Microsoft.EntityFrameworkCore;

internal class UtilityMeterDbContext(DbContextOptions<UtilityMeterDbContext> options) : DbContext(options)
{
    public DbSet<Organization> Organizations { get; set; }
    public DbSet<Condominium> Condominiums { get; set; }
    public DbSet<UtilityProperty> Properties { get; set; }
    public DbSet<Meter> Meters { get; set; }
    public DbSet<BillingPeriod> BillingPeriods { get; set; }
    public DbSet<Reading> Readings { get; set; }
    public DbSet<Evidence> Evidence { get; set; }

    public DbSet<Application.Extraction.ExtractionJob> ExtractionJobs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Application.Extraction.ExtractionJob>(job =>
        {
            job.HasKey(x => x.Id);
            job.HasIndex(x => x.EvidenceId).IsUnique();
            job.HasIndex(x => new { x.Status, x.AvailableAt });
            job.Property(x => x.ResultJson).HasColumnType("jsonb");
            job.HasOne<Evidence>().WithMany().HasForeignKey(x => x.EvidenceId);
        });

        _ = modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}
