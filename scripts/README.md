# Structured Memory Engine Test Tools

## Test Data Generator

The `generate_test_data.js` script creates test data with controlled duplication rates to validate the Structured Memory Engine's deduplication mechanisms.

### Features

- **Controlled Duplication**: Creates 200 conversations with a precise 13% duplication rate
- **Realistic Data**: Generates varied AI-related conversations
- **Tagged for Analysis**: Includes metadata to track duplicates
- **Database Integration**: Inserts directly into your PostgreSQL database

### Usage

1. Make sure your PostgreSQL database is running and configured correctly
2. Run the script from the project root:

```bash
node scripts/generate_test_data.js
```

### Recommended Test Flow

1. Start with a clean database state
2. Run the test data generator to populate the database
3. Use the "Sync to Pinecone" feature with your chosen index 
4. Check the reported deduplication rate - it should be close to 13%
5. Verify through the stats panel or database directly

### Cleaning Test Data

The test data generator automatically cleans up previous test data before inserting new records.
All test data is clearly marked with "[Test Data]" prefixes and special metadata fields.

### Database Schema Impact

The script inserts into:
- `messages` table: User and assistant messages
- `memories` table: The vector store entries (with placeholder embeddings)

### Technical Details

- The placeholder embeddings are not suitable for actual vector similarity testing
- To run a full end-to-end test, use the Structured Memory Engine's API interface to insert content
- Duplication validation is based on the memory ID hash, which is generated consistently

### Extending for Specific Tests

You can modify the script to test specific scenarios:
- Adjust the `DUPLICATION_RATE` constant to test different duplication levels
- Modify the conversation templates for domain-specific testing
- Add additional metadata fields for specialized tracking