-- Public guest booking site: guest accounts, holds, outbox and room-type media.

-- CreateEnum
CREATE TYPE "GuestAccountStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "GuestAuthTokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "guest_payment_reference" TEXT,
ADD COLUMN     "hold_expires_at" TIMESTAMP(3),
ADD COLUMN     "payment_submitted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "room_types" ADD COLUMN     "image_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "short_description" TEXT;

-- CreateTable
CREATE TABLE "guest_accounts" (
    "id" TEXT NOT NULL,
    "guest_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_verified_at" TIMESTAMP(3),
    "status" "GuestAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_sessions" (
    "id" TEXT NOT NULL,
    "guest_account_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_auth_tokens" (
    "id" TEXT NOT NULL,
    "guest_account_id" TEXT NOT NULL,
    "type" "GuestAuthTokenType" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_outbox" (
    "id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "template" TEXT,
    "payload" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "related_type" TEXT,
    "related_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_accounts_guest_id_key" ON "guest_accounts"("guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_accounts_email_key" ON "guest_accounts"("email");

-- CreateIndex
CREATE INDEX "guest_accounts_email_idx" ON "guest_accounts"("email");

-- CreateIndex
CREATE INDEX "guest_accounts_status_idx" ON "guest_accounts"("status");

-- CreateIndex
CREATE INDEX "guest_sessions_guest_account_id_idx" ON "guest_sessions"("guest_account_id");

-- CreateIndex
CREATE INDEX "guest_sessions_expires_at_idx" ON "guest_sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "guest_auth_tokens_token_hash_key" ON "guest_auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "guest_auth_tokens_guest_account_id_idx" ON "guest_auth_tokens"("guest_account_id");

-- CreateIndex
CREATE INDEX "guest_auth_tokens_type_idx" ON "guest_auth_tokens"("type");

-- CreateIndex
CREATE INDEX "guest_auth_tokens_expires_at_idx" ON "guest_auth_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "message_outbox_status_idx" ON "message_outbox"("status");

-- CreateIndex
CREATE INDEX "message_outbox_channel_idx" ON "message_outbox"("channel");

-- CreateIndex
CREATE INDEX "message_outbox_created_at_idx" ON "message_outbox"("created_at");

-- CreateIndex
CREATE INDEX "message_outbox_related_type_related_id_idx" ON "message_outbox"("related_type", "related_id");

-- CreateIndex
CREATE INDEX "reservations_hold_expires_at_idx" ON "reservations"("hold_expires_at");

-- AddForeignKey
ALTER TABLE "guest_accounts" ADD CONSTRAINT "guest_accounts_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_sessions" ADD CONSTRAINT "guest_sessions_guest_account_id_fkey" FOREIGN KEY ("guest_account_id") REFERENCES "guest_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_auth_tokens" ADD CONSTRAINT "guest_auth_tokens_guest_account_id_fkey" FOREIGN KEY ("guest_account_id") REFERENCES "guest_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
