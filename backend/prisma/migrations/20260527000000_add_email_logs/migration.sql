-- CreateTable
CREATE TABLE "email_logs" (
    "id"        TEXT NOT NULL,
    "template"  TEXT NOT NULL,
    "to"        TEXT NOT NULL,
    "status"    TEXT NOT NULL,
    "attempts"  INTEGER NOT NULL DEFAULT 0,
    "error"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt"    TIMESTAMP(3),

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);
