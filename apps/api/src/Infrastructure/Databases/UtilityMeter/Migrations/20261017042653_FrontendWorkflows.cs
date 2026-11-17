using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CleanMinimalApi.Databases.UtilityMeter.Migrations
{
    /// <inheritdoc />
    public partial class FrontendWorkflows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReviewStatus",
                table: "Readings",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "Version",
                table: "Readings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            // Preserve the review state of existing manual and OCR readings.
            migrationBuilder.Sql("""
                UPDATE "Readings" r SET "Version" = 1, "ReviewStatus" = CASE
                    WHEN r."Status" = 'Confirmed' OR EXISTS
                        (SELECT 1 FROM "ExtractionJobs" j WHERE j."ConfirmedReadingId" = r."Id") THEN 'Confirmed'
                    WHEN r."Status" IN ('Rejected', 'Voided') THEN r."Status"
                    ELSE 'Pending' END;
                """);

            migrationBuilder.CreateTable(
                name: "ReadingRevisions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReadingId = table.Column<Guid>(type: "uuid", nullable: false),
                    ChangedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Action = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    BeforeJson = table.Column<string>(type: "text", nullable: true),
                    AfterJson = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReadingRevisions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReadingRevisions_Readings_ReadingId",
                        column: x => x.ReadingId,
                        principalTable: "Readings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReadingRevisions_ReadingId_ChangedAt",
                table: "ReadingRevisions",
                columns: new[] { "ReadingId", "ChangedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ReadingRevisions");

            migrationBuilder.DropColumn(
                name: "ReviewStatus",
                table: "Readings");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "Readings");
        }
    }
}
