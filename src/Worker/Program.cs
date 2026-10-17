using CleanMinimalApi.Application;
using CleanMinimalApi.Infrastructure;
using CleanMinimalApi.Worker;
using Serilog;

var host = Host.CreateApplicationBuilder(args);

host.Services.AddInfrastructure(host.Configuration);
host.Services.AddSerilog((services, logger) => logger.MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", Serilog.Events.LogEventLevel.Warning)
    .Enrich.WithProperty("ApplicationName", "UtilityMeter-Worker")
    .WriteTo.Console()
    .WriteTo.Seq(host.Configuration["Seq:Url"] ?? "http://localhost:5341"));
host.Services.AddApplication();
host.Services.AddHostedService<QueuedBackgroundWorker>();

await host.Build().RunAsync();
