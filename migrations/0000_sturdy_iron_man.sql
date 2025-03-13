CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
 CREATE TYPE "text_role" AS ENUM('user', 'assistant');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "memories" (
        "id" serial PRIMARY KEY NOT NULL,
        "content" text NOT NULL,
        "embedding" text NOT NULL,
        "type" text NOT NULL,
        "message_id" integer,
        "timestamp" timestamp DEFAULT now() NOT NULL,
        "metadata" jsonb
);

CREATE TABLE IF NOT EXISTS "messages" (
        "id" serial PRIMARY KEY NOT NULL,
        "content" text NOT NULL,
        "role" text NOT NULL,
        "timestamp" timestamp DEFAULT now() NOT NULL,
        "model_id" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "models" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "provider" text NOT NULL,
        "max_tokens" integer NOT NULL,
        "is_enabled" boolean DEFAULT true NOT NULL
);

CREATE TABLE IF NOT EXISTS "settings" (
        "id" serial PRIMARY KEY NOT NULL,
        "context_size" integer DEFAULT 5 NOT NULL,
        "similarity_threshold" text DEFAULT '0.75' NOT NULL,
        "default_model_id" text DEFAULT 'gpt-3.5-turbo' NOT NULL,
        "auto_clear_memories" boolean DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "username" text NOT NULL,
        "password" text NOT NULL,
        CONSTRAINT "users_username_unique" UNIQUE("username")
);

-- Index will be created in a separate migration

ALTER TABLE "memories" ADD CONSTRAINT "memories_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE cascade ON UPDATE no action;
