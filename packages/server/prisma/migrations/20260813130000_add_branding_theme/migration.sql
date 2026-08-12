-- CreateTable
CREATE TABLE "branding_themes" (
    "id" TEXT NOT NULL,
    "villa_name" TEXT NOT NULL DEFAULT 'NS Luxury Villa',
    "villa_tagline" TEXT NOT NULL DEFAULT 'Property Operations',
    "logo_url" TEXT,
    "login_bg_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#174b59',
    "secondary_color" TEXT NOT NULL DEFAULT '#b18a55',
    "accent_color" TEXT NOT NULL DEFAULT '#d9bd91',
    "bg_color" TEXT NOT NULL DEFAULT '#f5f6f4',
    "text_color" TEXT NOT NULL DEFAULT '#14232b',
    "text_muted" TEXT NOT NULL DEFAULT '#7a858a',
    "border_color" TEXT NOT NULL DEFAULT '#e5e8e5',
    "success_color" TEXT NOT NULL DEFAULT '#2d8a68',
    "warning_color" TEXT NOT NULL DEFAULT '#d97706',
    "error_color" TEXT NOT NULL DEFAULT '#dc2626',
    "info_color" TEXT NOT NULL DEFAULT '#0284c7',
    "font_family" TEXT NOT NULL DEFAULT 'system-ui, -apple-system, sans-serif',
    "heading_font" TEXT NOT NULL DEFAULT 'Manrope, sans-serif',
    "custom_css" TEXT,
    "use_custom_login" BOOLEAN NOT NULL DEFAULT false,
    "enable_dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branding_themes_pkey" PRIMARY KEY ("id")
);
