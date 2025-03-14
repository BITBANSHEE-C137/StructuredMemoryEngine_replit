import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { models } from "@shared/schema";
import { eq } from "drizzle-orm";

// Create a pg client with default environment variables
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL not found in environment variables");
}

// Initial database setup
export const migrationClient = postgres(connectionString, { max: 1 });
export const db = drizzle(migrationClient);

// Function to run migrations
export async function runMigrations() {
  try {
    console.log("Running migrations...");
    await migrate(db, { migrationsFolder: "./migrations" });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

// Function to seed default models
export async function seedModels() {
  try {
    // Check if we already have models in the database
    const existingModels = await db.select().from(models);
    
    if (existingModels.length > 0) {
      console.log("Models already seeded, skipping...");
      return;
    }
    
    console.log("Seeding default models...");
    
    // Insert default OpenAI models
    await db.insert(models).values([
      // Chat models
      {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
        maxTokens: 8192,
        isEnabled: true,
      },
      {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        provider: "openai",
        maxTokens: 4096,
        isEnabled: true,
      },
      // Embedding models
      {
        id: "text-embedding-ada-002",
        name: "Ada 002 (Embeddings)",
        provider: "openai",
        maxTokens: 8191,
        isEnabled: true,
      },
      {
        id: "text-embedding-3-small",
        name: "Embedding 3 Small",
        provider: "openai",
        maxTokens: 8191,
        isEnabled: true,
      },
      {
        id: "text-embedding-3-large",
        name: "Embedding 3 Large",
        provider: "openai",
        maxTokens: 8191,
        isEnabled: true,
      },
    ]);
    
    // Insert default Anthropic models
    await db.insert(models).values([
      {
        id: "claude-3-7-sonnet-20250219",
        name: "Claude 3 Sonnet",
        provider: "anthropic",
        maxTokens: 200000,
        isEnabled: true,
      },
      {
        id: "claude-instant-1.2",
        name: "Claude Instant",
        provider: "anthropic",
        maxTokens: 100000,
        isEnabled: true,
      },
    ]);
    
    console.log("Models seeded successfully");
  } catch (error) {
    console.error("Error seeding models:", error);
  }
}

// Initialize default settings if they don't exist
export async function initializeSettings() {
  try {
    console.log("Checking settings table for threshold factors...");
    
    // Check if we need to add the new threshold factor columns
    const columnCheck = await migrationClient`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'settings' 
      AND column_name = 'question_threshold_factor'
    `;
    
    if (columnCheck.length === 0) {
      console.log("Adding new threshold factor columns to settings table...");
      
      // Add the new columns for threshold factors
      await migrationClient`
        ALTER TABLE settings 
        ADD COLUMN IF NOT EXISTS question_threshold_factor TEXT NOT NULL DEFAULT '70%';
      `;
      
      await migrationClient`
        ALTER TABLE settings 
        ADD COLUMN IF NOT EXISTS statement_threshold_factor TEXT NOT NULL DEFAULT '85%';
      `;
      
      console.log("Successfully added threshold factor columns to settings table");
    } else {
      console.log("Threshold factor columns already exist in settings table");
    }
    
    console.log("Settings initialization completed");
  } catch (error) {
    console.error("Error initializing settings:", error);
  }
}

// Function to check if pgvector extension is installed
export async function checkPgVectorExtension() {
  try {
    // Execute raw SQL to check if pgvector extension exists
    const result = await migrationClient`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as has_vector;
    `;
    
    const hasVector = result[0]?.has_vector;
    
    if (!hasVector) {
      console.warn("pgvector extension is not installed in the database. Vector search functionality will not work properly.");
      console.warn("Please run CREATE EXTENSION vector; in your database to enable vector search.");
    } else {
      console.log("pgvector extension is installed and ready.");
    }
  } catch (error) {
    console.error("Error checking pgvector extension:", error);
  }
}

// Function to apply the pgvector fix migration directly
export async function applyPgvectorFix() {
  try {
    console.log("Applying pgvector fix migration...");
    
    // First, check if the migration needs to be applied by verifying the vector column type
    const columnCheck = await migrationClient`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'memories' 
      AND column_name = 'embedding'
    `;
    
    // Check if memories table exists and embedding column has vector type
    if (columnCheck.length > 0 && columnCheck[0]?.data_type === 'USER-DEFINED') {
      console.log("Vector column already has correct type, skipping pgvector fix");
      
      // Make sure extension exists
      await migrationClient`CREATE EXTENSION IF NOT EXISTS vector`;
      
      // Check if index exists, and create if needed
      const indexCheck = await migrationClient`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'memories' 
        AND indexname = 'embedding_idx'
      `;
      
      if (indexCheck.length === 0) {
        console.log("Creating vector index...");
        try {
          await migrationClient`CREATE INDEX IF NOT EXISTS embedding_idx ON memories USING ivfflat (embedding vector_cosine_ops)`;
        } catch (error: any) {
          console.warn(`Error creating index (continuing anyway): ${error.message}`);
        }
      }
      
      return;
    }
    
    // If we need to apply the migration, read the migration file
    const fs = await import('fs');
    const path = await import('path');
    const migrationPath = path.resolve('./migrations/0002_fix_pgvector.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      return;
    }
    
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the migration into individual statements
    const statements = migrationSql
      .replace(/--.*?\n/g, '\n') // Remove comments
      .split(';')
      .filter(stmt => stmt.trim());
    
    // Execute each statement
    for (const stmt of statements) {
      if (stmt.trim()) {
        try {
          await migrationClient.unsafe(stmt);
        } catch (error: any) {
          console.warn(`Error executing statement (continuing anyway): ${error.message}`);
        }
      }
    }
    
    console.log("pgvector fix migration completed");
  } catch (error) {
    console.error("Error applying pgvector fix:", error);
  }
}

// Initialize database (run migrations, seed data, etc.)
export async function initializeDatabase() {
  await runMigrations();
  await checkPgVectorExtension();
  // Apply our custom pgvector fix
  await applyPgvectorFix();
  await seedModels();
  await initializeSettings();
}
