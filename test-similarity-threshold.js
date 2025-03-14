/**
 * Utility script to test the similarity threshold passing from settings to storage layer
 */
import axios from 'axios';

async function testSimilarityThreshold() {
  try {
    console.log('Testing similarity threshold flow from settings to storage');
    
    // First, get current settings
    const settingsResponse = await axios.get('http://localhost:5000/api/settings');
    console.log('Current settings:', settingsResponse.data);
    console.log(`Current similarity threshold in settings: ${settingsResponse.data.similarityThreshold}`);
    
    // Test a message to see threshold passing
    const chatResponse = await axios.post('http://localhost:5000/api/chat', {
      content: 'What are some good science fiction movies?',
      modelId: 'gpt-4o'
    });
    
    console.log('Response received');
    console.log('Relevant memories count:', chatResponse.data.context.relevantMemories.length);
    
    if (chatResponse.data.context.relevantMemories.length > 0) {
      console.log('Similarity scores:');
      chatResponse.data.context.relevantMemories.forEach(memory => {
        console.log(`- Memory ${memory.id}: ${memory.similarity} (${memory.similarity * 100}%)`);
      });
      
      // Get min similarity to check threshold enforcement
      const minSimilarity = Math.min(...chatResponse.data.context.relevantMemories.map(m => m.similarity));
      console.log(`Minimum similarity found: ${minSimilarity} (${minSimilarity * 100}%)`);
      console.log(`Expected threshold from settings: ${settingsResponse.data.similarityThreshold}`);
      
      if (minSimilarity >= parseFloat(settingsResponse.data.similarityThreshold)) {
        console.log('✅ Threshold is being properly enforced');
      } else {
        console.log('❌ Threshold enforcement issue detected');
      }
    } else {
      console.log('No relevant memories found, cannot verify threshold');
    }
    
  } catch (error) {
    console.error('Error testing similarity threshold:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.data);
    }
  }
}

testSimilarityThreshold();