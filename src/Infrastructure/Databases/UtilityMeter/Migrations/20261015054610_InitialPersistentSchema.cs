using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CleanMinimalApi.Databases.UtilityMeter.Migrations
{
    /// <inheritdoc />
    public partial class InitialPersistentSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BillingPeriods",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Start = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    End = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BillingPeriods", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Condominiums",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    PropertyIds = table.Column<string>(type: "text", nullable: false),
                    MainMeterId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Condominiums", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Evidence",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StorageKey = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    FileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Hash = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Metadata = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Evidence", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Meters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: false),
                    SerialNumber = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ResourceType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Unit = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Model = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    InstalledAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Meters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Organizations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    ContactEmail = table.Column<string>(type: "character varying(250)", maxLength: 250, nullable: true),
                    PropertyIds = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Organizations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Properties",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OrganizationId = table.Column<Guid>(type: "uuid", nullable: true),
                    CondominiumId = table.Column<Guid>(type: "uuid", nullable: true),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ResourceType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MeterIds = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Properties", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Readings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    MeterId = table.Column<Guid>(type: "uuid", nullable: false),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                    BillingPeriodId = table.Column<Guid>(type: "uuid", nullable: true),
                    PreviousReadingId = table.Column<Guid>(type: "uuid", nullable: true),
                    Value = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Unit = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    MeasuredAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Source = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EvidenceIds = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Readings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ExtractionJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    EvidenceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    Attempts = table.Column<int>(type: "integer", nullable: false),
                    AvailableAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    LeaseUntil = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LeaseToken = table.Column<Guid>(type: "uuid", nullable: true),
                    Error = table.Column<string>(type: "text", nullable: true),
                    ResultJson = table.Column<string>(type: "jsonb", nullable: true),
                    ConfirmedReadingId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExtractionJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExtractionJobs_Evidence_EvidenceId",
                        column: x => x.EvidenceId,
                        principalTable: "Evidence",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Alert",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Severity = table.Column<int>(type: "integer", nullable: false),
                    Message = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    MeterId = table.Column<Guid>(type: "uuid", nullable: true),
                    PropertyId = table.Column<Guid>(type: "uuid", nullable: true),
                    ReadingId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Alert", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Alert_Readings_ReadingId",
                        column: x => x.ReadingId,
                        principalTable: "Readings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Alert_ReadingId",
                table: "Alert",
                column: "ReadingId");

            migrationBuilder.CreateIndex(
                name: "IX_BillingPeriods_End",
                table: "BillingPeriods",
                column: "End");

            migrationBuilder.CreateIndex(
                name: "IX_BillingPeriods_Start",
                table: "BillingPeriods",
                column: "Start");

            migrationBuilder.CreateIndex(
                name: "IX_BillingPeriods_Status",
                table: "BillingPeriods",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Condominiums_OrganizationId",
                table: "Condominiums",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_ExtractionJobs_EvidenceId",
                table: "ExtractionJobs",
                column: "EvidenceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ExtractionJobs_Status_AvailableAt",
                table: "ExtractionJobs",
                columns: new[] { "Status", "AvailableAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Meters_PropertyId",
                table: "Meters",
                column: "PropertyId");

            migrationBuilder.CreateIndex(
                name: "IX_Properties_CondominiumId",
                table: "Properties",
                column: "CondominiumId");

            migrationBuilder.CreateIndex(
                name: "IX_Properties_OrganizationId",
                table: "Properties",
                column: "OrganizationId");

            migrationBuilder.CreateIndex(
                name: "IX_Readings_BillingPeriodId",
                table: "Readings",
                column: "BillingPeriodId");

            migrationBuilder.CreateIndex(
                name: "IX_Readings_MeterId",
                table: "Readings",
                column: "MeterId");

            migrationBuilder.CreateIndex(
                name: "IX_Readings_PropertyId",
                table: "Readings",
                column: "PropertyId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Alert");

            migrationBuilder.DropTable(
                name: "BillingPeriods");

            migrationBuilder.DropTable(
                name: "Condominiums");

            migrationBuilder.DropTable(
                name: "ExtractionJobs");

            migrationBuilder.DropTable(
                name: "Meters");

            migrationBuilder.DropTable(
                name: "Organizations");

            migrationBuilder.DropTable(
                name: "Properties");

            migrationBuilder.DropTable(
                name: "Readings");

            migrationBuilder.DropTable(
                name: "Evidence");
        }
    }
}
