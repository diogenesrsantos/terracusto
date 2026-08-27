-- Segundo período opcional para jornadas com intervalo, preservando lançamentos atuais.
ALTER TABLE "AccountingEntry"
  ADD COLUMN "secondStartAt" TIMESTAMP(3),
  ADD COLUMN "secondEndAt" TIMESTAMP(3);
