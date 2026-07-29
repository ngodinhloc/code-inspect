import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1785326873000 implements MigrationInterface {
  name = 'InitialSchema1785326873000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS "backend"`);

    await queryRunner.query(`
      CREATE TABLE "backend"."projects" (
        "id" SERIAL NOT NULL,
        "uuid" uuid NOT NULL,
        "repository_url" character varying(500) NOT NULL,
        "branch" character varying(200) NOT NULL DEFAULT 'main',
        "status" character varying(20) NOT NULL DEFAULT 'CREATED',
        "failure_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_projects_uuid" UNIQUE ("uuid"),
        CONSTRAINT "PK_projects" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "backend"."project_status_history" (
        "id" SERIAL NOT NULL,
        "project_id" integer NOT NULL,
        "status" character varying(20) NOT NULL,
        "reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_project_status_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_project_status_history_project_id"
      ON "backend"."project_status_history" ("project_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "backend"."project_status_history"
      ADD CONSTRAINT "FK_project_status_history_project"
      FOREIGN KEY ("project_id") REFERENCES "backend"."projects"("id")
    `);

    await queryRunner.query(`
      CREATE TABLE "backend"."chats" (
        "id" SERIAL NOT NULL,
        "uuid" uuid NOT NULL,
        "project_id" uuid NOT NULL,
        "question" text NOT NULL,
        "contents" jsonb NOT NULL DEFAULT '[]',
        "status" character varying(20) NOT NULL DEFAULT 'running',
        "failure_reason" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_chats_uuid" UNIQUE ("uuid"),
        CONSTRAINT "PK_chats" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_chats_project_id" ON "backend"."chats" ("project_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "backend"."chats"`);
    await queryRunner.query(
      `ALTER TABLE "backend"."project_status_history" DROP CONSTRAINT "FK_project_status_history_project"`,
    );
    await queryRunner.query(`DROP TABLE "backend"."project_status_history"`);
    await queryRunner.query(`DROP TABLE "backend"."projects"`);
  }
}
