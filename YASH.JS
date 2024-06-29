const autocannon = require('autocannon');

const url = 'https://www.ackinfra.in/'; // Apni website ka URL daalein

// Load test configuration
const opts = {
  url,
  connections: 50000, // Kitne concurrent users test karne hain
  duration: 10, // Test kitne seconds chalega
  method: 'GET', // HTTP method used for requests
};

console.log(`Starting load test on ${url}`);

autocannon(opts, (err, result) => {
  if (err) {
    console.error('Error during load test:', err);
    return;
  }

  console.log('Load test finished.');
  console.log('Results:', result);

  // Calculate requests per second
  const requestsPerSecond = result.requests.average.toFixed(2);
 
});