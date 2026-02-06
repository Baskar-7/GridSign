using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GridSign.Migrations
{
    /// <inheritdoc />
    public partial class EmailVerificationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTE: Original migration attempted to drop FK & column UserId from Template.
            // These operations already executed during a partial run and will now fail if repeated.
            // They are removed to allow idempotent completion after partial application.
            // In a fresh database (where UserId still exists), generate a new migration to remove it.

            // Purpose column already exists (partial migration previously applied). Skipping AddColumn to avoid duplicate column error.
            // For a fresh database initialize from a consolidated migration instead of this patched one.

            // Skipping AddColumn for Users.IsMailVerified (already exists from partial migration run).
            // Skipping AddColumn for Users.PendingEmail (already exists from partial migration run).

            // Column IsCommonField already exists in production schema; skip adding to avoid duplicate column error.
            // If missing in a fresh environment, create a follow-up migration with AddColumn + default.

            migrationBuilder.AlterColumn<Guid>(
                name: "TemplateOwner",
                table: "Template",
                type: "char(255)",
                maxLength: 255,
                nullable: false,
                collation: "ascii_general_ci",
                oldClrType: typeof(string),
                oldType: "char(255)",
                oldMaxLength: 255)
                .OldAnnotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Template_TemplateOwner",
                table: "Template",
                column: "TemplateOwner");

            migrationBuilder.AddForeignKey(
                name: "FK_Template_Users_TemplateOwner",
                table: "Template",
                column: "TemplateOwner",
                principalTable: "Users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Template_Users_TemplateOwner",
                table: "Template");

            migrationBuilder.DropIndex(
                name: "IX_Template_TemplateOwner",
                table: "Template");

            // Skipped dropping Purpose (was not added in Up due to idempotent patch).

            // Skipped dropping Users.IsMailVerified (not added in patched Up).
            // Skipped dropping Users.PendingEmail (not added in patched Up).

            // Skipped removing IsCommonField (was not added in Up for idempotent fix).

            migrationBuilder.AlterColumn<string>(
                name: "TemplateOwner",
                table: "Template",
                type: "char(255)",
                maxLength: 255,
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "char(255)",
                oldMaxLength: 255)
                .Annotation("MySql:CharSet", "utf8mb4")
                .OldAnnotation("Relational:Collation", "ascii_general_ci");

            // UserId column restoration skipped (Up did not remove it in this adjusted migration).

            migrationBuilder.CreateIndex(
                name: "IX_Template_UserId",
                table: "Template",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Template_Users_UserId",
                table: "Template",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "UserId");
        }
    }
}
