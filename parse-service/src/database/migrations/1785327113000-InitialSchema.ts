import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1785327113000 implements MigrationInterface {
  name = 'InitialSchema1785327113000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "parse"`);

    await queryRunner.query(`
      CREATE TABLE "parse"."files" (
        "id" SERIAL NOT NULL,
        "project_id" uuid NOT NULL,
        "path" character varying(1000) NOT NULL,
        "language" character varying(40) NOT NULL,
        "size" integer NOT NULL,
        "content" text NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_files" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_files_project_id" ON "parse"."files" ("project_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "parse"."symbols" (
        "id" SERIAL NOT NULL,
        "project_id" uuid NOT NULL,
        "type" character varying(20) NOT NULL,
        "name" character varying(500) NOT NULL,
        "language" character varying(40) NOT NULL,
        "content" text NOT NULL,
        "start_line" integer NOT NULL,
        "end_line" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "file_id" integer NOT NULL,
        CONSTRAINT "PK_symbols" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_symbols_project_id" ON "parse"."symbols" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_symbols_file_id" ON "parse"."symbols" ("file_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "parse"."symbols"
      ADD CONSTRAINT "FK_symbols_file" FOREIGN KEY ("file_id") REFERENCES "parse"."files"("id")
    `);

    await queryRunner.query(`
      CREATE TABLE "parse"."symbol_dependencies" (
        "id" SERIAL NOT NULL,
        "symbol_id" integer NOT NULL,
        "dependency_name" character varying(500) NOT NULL,
        CONSTRAINT "PK_symbol_dependencies" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_symbol_dependencies_symbol_id" ON "parse"."symbol_dependencies" ("symbol_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "parse"."symbol_dependencies"
      ADD CONSTRAINT "FK_symbol_dependencies_symbol" FOREIGN KEY ("symbol_id") REFERENCES "parse"."symbols"("id")
    `);

    await queryRunner.query(`
      CREATE TABLE "parse"."api_endpoints" (
        "id" SERIAL NOT NULL,
        "project_id" uuid NOT NULL,
        "method" character varying(10) NOT NULL,
        "path" character varying(500) NOT NULL,
        "handler_name" character varying(500),
        "framework" character varying(40) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "file_id" integer NOT NULL,
        CONSTRAINT "PK_api_endpoints" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_api_endpoints_project_id" ON "parse"."api_endpoints" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_api_endpoints_file_id" ON "parse"."api_endpoints" ("file_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "parse"."api_endpoints"
      ADD CONSTRAINT "FK_api_endpoints_file" FOREIGN KEY ("file_id") REFERENCES "parse"."files"("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "parse"."api_endpoints" DROP CONSTRAINT "FK_api_endpoints_file"`,
    );
    await queryRunner.query(`DROP TABLE "parse"."api_endpoints"`);

    await queryRunner.query(
      `ALTER TABLE "parse"."symbol_dependencies" DROP CONSTRAINT "FK_symbol_dependencies_symbol"`,
    );
    await queryRunner.query(`DROP TABLE "parse"."symbol_dependencies"`);

    await queryRunner.query(
      `ALTER TABLE "parse"."symbols" DROP CONSTRAINT "FK_symbols_file"`,
    );
    await queryRunner.query(`DROP TABLE "parse"."symbols"`);

    await queryRunner.query(`DROP TABLE "parse"."files"`);
  }
}
