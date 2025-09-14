#!/usr/bin/env node
// test-local-memory.js - Quick test script to verify local memory system is working

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const TEST_USER = 'test_user_123';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testHealthCheck() {
  log('\n🏥 Testing Health Check...', 'blue');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    log(`✅ Server is healthy!`, 'green');
    log(`   Status: ${response.data.status}`);
    log(`   Storage: ${response.data.storage}`);
    log(`   OpenAI: ${response.data.openai_enabled ? 'Enabled' : 'Disabled (using text search)'}`);
    return true;
  } catch (error) {
    log(`❌ Health check failed: ${error.message}`, 'red');
    log(`   Make sure the server is running: npm start`, 'yellow');
    return false;
  }
}

async function testAddMemory() {
  log('\n🧠 Testing Add Memory...', 'blue');
  try {
    const response = await axios.post(`${BASE_URL}/api/memory/add`, {
      content: "I am really good at calculus but struggle with discrete mathematics",
      metadata: {
        userId: TEST_USER,
        source: 'test',
        category: 'learning_preference'
      }
    });
    
    if (response.data.success) {
      log(`✅ Memory added successfully!`, 'green');
      log(`   ID: ${response.data.memory.id}`);
      log(`   Category: ${response.data.memory.category}`);
      return response.data.memory.id;
    } else {
      log(`❌ Failed to add memory`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Add memory failed: ${error.message}`, 'red');
    return null;
  }
}

async function testSearchMemory() {
  log('\n🔍 Testing Search Memory...', 'blue');
  try {
    const response = await axios.post(`${BASE_URL}/api/memory/search`, {
      query: "mathematics",
      userId: TEST_USER,
      limit: 5
    });
    
    if (response.data.success) {
      log(`✅ Memory search successful!`, 'green');
      log(`   Found ${response.data.memories.length} memories`);
      
      response.data.memories.forEach((memory, index) => {
        log(`   ${index + 1}. "${memory.content.substring(0, 50)}..." (Score: ${memory.relevanceScore.toFixed(2)})`);
      });
      
      return response.data.memories.length > 0;
    } else {
      log(`❌ Memory search failed`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Search memory failed: ${error.message}`, 'red');
    return false;
  }
}

async function testAddNote() {
  log('\n📝 Testing Add Note...', 'blue');
  try {
    const response = await axios.post(`${BASE_URL}/api/notes/add`, {
      content: "Remember: Integration by parts formula is ∫u dv = uv - ∫v du",
      metadata: {
        userId: TEST_USER,
        title: "Calculus Notes",
        url: "https://example.com/calculus"
      }
    });
    
    if (response.data.success) {
      log(`✅ Note added successfully!`, 'green');
      log(`   ID: ${response.data.note.id}`);
      log(`   Title: ${response.data.note.title}`);
      return response.data.note.id;
    } else {
      log(`❌ Failed to add note`, 'red');
      return null;
    }
  } catch (error) {
    log(`❌ Add note failed: ${error.message}`, 'red');
    return null;
  }
}

async function testGetUserData() {
  log('\n📊 Testing Get User Data...', 'blue');
  try {
    // Get memories
    const memoriesResponse = await axios.get(`${BASE_URL}/api/memory/user/${TEST_USER}`);
    
    // Get notes  
    const notesResponse = await axios.get(`${BASE_URL}/api/notes/user/${TEST_USER}`);
    
    // Get stats
    const statsResponse = await axios.get(`${BASE_URL}/api/stats/user/${TEST_USER}`);
    
    log(`✅ User data retrieved successfully!`, 'green');
    log(`   Memories: ${memoriesResponse.data.memories.length}`);
    log(`   Notes: ${notesResponse.data.notes.length}`);
    log(`   Total memories: ${statsResponse.data.stats.total_memories}`);
    log(`   Categories: ${statsResponse.data.stats.categories_count}`);
    
    return true;
  } catch (error) {
    log(`❌ Get user data failed: ${error.message}`, 'red');
    return false;
  }
}

async function testMindMap() {
  log('\n🗺️ Testing Mind Map...', 'blue');
  try {
    // Add a node
    const nodeResponse = await axios.post(`${BASE_URL}/api/mindmap/node`, {
      label: "Calculus",
      metadata: {
        userId: TEST_USER,
        x: 100,
        y: 100,
        color: "#3B82F6"
      }
    });
    
    const nodeId = nodeResponse.data.node.id;
    
    // Add another node
    const node2Response = await axios.post(`${BASE_URL}/api/mindmap/node`, {
      label: "Integration",
      metadata: {
        userId: TEST_USER,
        x: 200,
        y: 150,
        color: "#10B981"
      }
    });
    
    const node2Id = node2Response.data.node.id;
    
    // Add an edge
    await axios.post(`${BASE_URL}/api/mindmap/edge`, {
      sourceNodeId: nodeId,
      targetNodeId: node2Id,
      metadata: {
        userId: TEST_USER,
        label: "includes"
      }
    });
    
    // Get the mind map
    const mindmapResponse = await axios.get(`${BASE_URL}/api/mindmap/user/${TEST_USER}`);
    
    log(`✅ Mind map operations successful!`, 'green');
    log(`   Nodes: ${mindmapResponse.data.mindmap.nodes.length}`);
    log(`   Edges: ${mindmapResponse.data.mindmap.edges.length}`);
    
    return true;
  } catch (error) {
    log(`❌ Mind map test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testFileStorage() {
  log('\n📁 Testing File Storage...', 'blue');
  const fs = require('fs');
  const path = require('path');
  
  try {
    const dataDir = path.join(__dirname, 'data');
    const files = ['memories.json', 'notes.json', 'mindmap.json'];
    
    let filesExist = 0;
    for (const file of files) {
      const filePath = path.join(dataDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        log(`   ✅ ${file} exists (${stats.size} bytes)`);
        filesExist++;
      } else {
        log(`   ❌ ${file} missing`, 'yellow');
      }
    }
    
    if (filesExist === files.length) {
      log(`✅ All data files created successfully!`, 'green');
      return true;
    } else {
      log(`⚠️ Some data files missing (${filesExist}/${files.length})`, 'yellow');
      return false;
    }
  } catch (error) {
    log(`❌ File storage test failed: ${error.message}`, 'red');
    return false;
  }
}

async function testBackup() {
  log('\n💾 Testing Backup System...', 'blue');
  try {
    const response = await axios.post(`${BASE_URL}/api/backup`);
    
    if (response.data.success) {
      log(`✅ Backup created successfully!`, 'green');
      log(`   Backup file: ${response.data.backupFile}`);
      return true;
    } else {
      log(`❌ Backup failed`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Backup test failed: ${error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log(`${colors.bold}🧪 Local Memory System Test Suite${colors.reset}`, 'blue');
  log(`Testing server at: ${BASE_URL}`);
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'Add Memory', fn: testAddMemory },
    { name: 'Search Memory', fn: testSearchMemory },
    { name: 'Add Note', fn: testAddNote },
    { name: 'Get User Data', fn: testGetUserData },
    { name: 'Mind Map', fn: testMindMap },
    { name: 'File Storage', fn: testFileStorage },
    { name: 'Backup System', fn: testBackup }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      } else {
        failed++;
      }
    } catch (error) {
      log(`❌ ${test.name} crashed: ${error.message}`, 'red');
      failed++;
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  log(`\n${colors.bold}📊 Test Results:${colors.reset}`);
  log(`✅ Passed: ${passed}`, 'green');
  log(`❌ Failed: ${failed}`, failed > 0 ? 'red' : 'reset');
  log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`, 
      passed === tests.length ? 'green' : 'yellow');
  
  if (passed === tests.length) {
    log(`\n🎉 All tests passed! Your local memory system is working perfectly!`, 'green');
    log(`\n🚀 Next steps:`, 'blue');
    log(`   1. Your extension can now use: ${BASE_URL}`);
    log(`   2. Check your data files in: ./data/`);
    log(`   3. Start building your AI features!`);
  } else {
    log(`\n⚠️ Some tests failed. Check the errors above.`, 'yellow');
    log(`\n🔧 Common fixes:`, 'blue');
    log(`   1. Make sure server is running: npm start`);
    log(`   2. Check port 3000 is available`);
    log(`   3. Install dependencies: npm install`);
  }
}

// Run the tests
if (require.main === module) {
  runAllTests().catch(error => {
    log(`\n💥 Test suite crashed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { runAllTests };
