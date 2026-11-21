import {describe, expect, it} from 'vitest'
import {NO_TRANSACTION_DIRECTIVE, isNoTransactionMigration, splitNoTransactionStatements} from '../src/database/migrate.js'

describe('no-transaction migration directive', () => {
  it('is recognised only as the exact first line', () => {
    expect(isNoTransactionMigration(`${NO_TRANSACTION_DIRECTIVE}\nSELECT 1;\n`)).toBe(true)
    expect(isNoTransactionMigration(`\uFEFF${NO_TRANSACTION_DIRECTIVE}\r\nSELECT 1;`)).toBe(true)
    expect(isNoTransactionMigration(`-- 094: something\n${NO_TRANSACTION_DIRECTIVE}\nSELECT 1;`)).toBe(false)
    expect(isNoTransactionMigration('CREATE TABLE t (id int);')).toBe(false)
    expect(isNoTransactionMigration('-- modula:migrate no-transaction please\nSELECT 1;')).toBe(false)
  })

  it('splits standalone statements and drops comment lines', () => {
    expect(splitNoTransactionStatements(`${NO_TRANSACTION_DIRECTIVE}
-- comment
DROP INDEX CONCURRENTLY IF EXISTS a_idx;
CREATE INDEX CONCURRENTLY a_idx
  ON t (c)
  WHERE c IS NOT NULL;
INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '094')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`)).toEqual([
      'DROP INDEX CONCURRENTLY IF EXISTS a_idx',
      'CREATE INDEX CONCURRENTLY a_idx\n  ON t (c)\n  WHERE c IS NOT NULL',
      "INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '094')\nON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
    ])
  })

  it('refuses dollar quoting, transaction control and empty bodies', () => {
    expect(() => splitNoTransactionStatements(`${NO_TRANSACTION_DIRECTIVE}\nDO $$ BEGIN END $$;`)).toThrow(/dollar quoting/)
    expect(() => splitNoTransactionStatements(`${NO_TRANSACTION_DIRECTIVE}\nBEGIN;\nSELECT 1;`)).toThrow(/transactions/)
    expect(() => splitNoTransactionStatements(`${NO_TRANSACTION_DIRECTIVE}\ncommit;`)).toThrow(/transactions/)
    expect(() => splitNoTransactionStatements(`${NO_TRANSACTION_DIRECTIVE}\n-- nothing\n`)).toThrow(/no statements/)
  })
})
