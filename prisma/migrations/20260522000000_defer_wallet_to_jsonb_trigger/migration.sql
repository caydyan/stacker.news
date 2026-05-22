-- Make wallet_to_jsonb fire at end-of-transaction instead of after each statement.
--
-- The trigger materializes the Vault rows that a protocol relation row points at
-- into WalletProtocol.config. Prisma writes the relation table before the Vault
-- rows it references, so the previous AFTER trigger saw stale/missing Vault data
-- and application code had to issue a dummy second update to force the trigger
-- to re-fire after the Vault writes. As a deferrable constraint trigger the
-- firing is queued and runs at commit, by which point every Vault write in the
-- transaction is visible. Application code that needs WalletProtocol.config
-- immediately after saving should read it after the write transaction commits.

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'WalletSendNWC', 'WalletSendLNbits', 'WalletSendPhoenixd',
        'WalletSendBlink', 'WalletSendWebLN', 'WalletSendLNC',
        'WalletSendCLNRest', 'WalletSendClink',
        'WalletRecvNWC', 'WalletRecvLNbits', 'WalletRecvPhoenixd',
        'WalletRecvBlink', 'WalletRecvLightningAddress',
        'WalletRecvCLNRest', 'WalletRecvLNDGRPC', 'WalletRecvClink'
    ]
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS wallet_to_jsonb ON %I', tbl);
        EXECUTE format(
            'CREATE CONSTRAINT TRIGGER wallet_to_jsonb '
            'AFTER INSERT OR UPDATE ON %I '
            'DEFERRABLE INITIALLY DEFERRED '
            'FOR EACH ROW EXECUTE PROCEDURE wallet_to_jsonb()',
            tbl);
    END LOOP;
END $$;
