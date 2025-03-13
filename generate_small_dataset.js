// Utility script to run the test data generator with the 'small' dataset size
import { exec } from 'child_process';

console.log('Generating small test dataset...');
exec('node scripts/generate_test_data.js small', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});