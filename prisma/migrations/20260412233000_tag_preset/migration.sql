-- CreateTable: справочник тегов для операций
CREATE TABLE "TagPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagPreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TagPreset_name_key" ON "TagPreset"("name");
