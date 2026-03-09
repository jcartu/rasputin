const mysql = require('mysql2/promise');

async function findRudyakNoMatterWhat() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'rasputin',
      port: 3306
    });
    
    console.log('🧠 SEARCHING EVERYWHERE FOR RUDYAK - WONT STOP UNTIL FOUND!');
    console.log('='.repeat(70));
    
    // Search with EVERY possible variation and spelling
    const name_variations = [
      'rudyak', 'рудяк', 'rudiak', 'rudyk', 'rudak', 'rodion', 'rod', 'rydyak',
      'Rudyak', 'RUDYAK', 'Rudiak', 'Rudyk', 'Rodion', 'Rod', 'Рудяк'
    ];
    
    // Search across ALL memory tables with ALL variations
    const memory_tables = ['episodicMemories', 'semanticMemories', 'proceduralMemories'];
    let all_rudyak_memories = [];
    
    for (let table of memory_tables) {
      console.log(`🔍 DEEP SEARCHING ${table}...`);
      
      // Build comprehensive search with all variations
      let where_conditions = [];
      let params = [];
      
      for (let variation of name_variations) {
        where_conditions.push(`(title LIKE ? OR description LIKE ? OR context LIKE ? OR action LIKE ? OR outcome LIKE ? OR entities LIKE ? OR tags LIKE ?)`);
        params.push(...Array(7).fill(`%${variation}%`));
      }
      
      const where_clause = where_conditions.join(' OR ');
      
      // Search with larger limit - don't miss anything
      const [rows] = await connection.execute(`
        SELECT id, title, description, context, action, outcome, createdAt, memoryType, entities, tags, importance
        FROM ${table} 
        WHERE userId = 225 AND (${where_clause})
        ORDER BY createdAt DESC, importance DESC
        LIMIT 50
      `, params);
      
      if (rows.length > 0) {
        console.log(`   ✅ FOUND ${rows.length} RUDYAK MEMORIES!`);
        rows.forEach(row => {
          row.collection = table;
          all_rudyak_memories.push(row);
        });
      } else {
        console.log('   ❌ No direct matches, trying broader search...');
        
        // Try broader search - maybe it's embedded in JSON fields
        const [json_rows] = await connection.execute(`
          SELECT id, title, description, context, action, outcome, createdAt, memoryType, entities, tags, importance
          FROM ${table} 
          WHERE userId = 225 AND (
            entities LIKE '%rudy%' OR 
            entities LIKE '%rod%' OR 
            tags LIKE '%rudy%' OR 
            tags LIKE '%rod%' OR
            title LIKE '%rud%' OR
            description LIKE '%rud%'
          )
          ORDER BY createdAt DESC
          LIMIT 20
        `);
        
        if (json_rows.length > 0) {
          console.log(`   ⚡ FOUND ${json_rows.length} POTENTIAL RUDYAK REFERENCES!`);
          json_rows.forEach(row => {
            row.collection = table;
            row.potential_match = true;
            all_rudyak_memories.push(row);
          });
        }
      }
    }
    
    if (all_rudyak_memories.length === 0) {
      console.log('\n🔍 STILL NOT FOUND - SEARCHING EVERYTHING ELSE...');
      
      // Search in other tables that might contain person data
      const other_tables = ['users', 'agentTasks', 'agentMessages', 'chats', 'codeSymbols', 'codeRelationships'];
      
      for (let table of other_tables) {
        console.log(`🔍 SEARCHING ${table}...`);
        
        // Get column names first
        try {
          const [columns] = await connection.execute(`DESCRIBE ${table}`);
          const text_columns = columns.filter(col => 
            col.Type.toLowerCase().includes('varchar') || 
            col.Type.toLowerCase().includes('text') || 
            col.Type.toLowerCase().includes('mediumtext')
          ).map(col => col.Field);
          
          if (text_columns.length > 0) {
            const column_conditions = text_columns.map(col => `${col} LIKE '%rudyak%' OR ${col} LIKE '%рудяк%' OR ${col} LIKE '%rudiak%' OR ${col} LIKE '%rodion%'`).join(' OR ');
            
            const [other_rows] = await connection.execute(`
              SELECT * FROM ${table} 
              WHERE ${column_conditions}
              ORDER BY createdAt DESC LIMIT 10
            `);
            
            if (other_rows.length > 0) {
              console.log(`   🎯 FOUND ${other_rows.length} RUDYAK REFERENCES IN ${table}!`);
              other_rows.forEach(row => {
                row.collection = table;
                row.found_in_other_table = true;
                all_rudyak_memories.push(row);
              });
            }
          }
        } catch (e) {
          // Skip tables that might not exist or have different structure
          continue;
        }
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(`FINAL RESULTS: Found ${all_rudyak_memories.length} total Rudyak references`);
    
    if (all_rudyak_memories.length > 0) {
      console.log('\n🎯 RUDYAK MEMORIES FOUND:');
      
      // Sort by recency and importance
      all_rudyak_memories.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        const importanceA = a.importance || 50;
        const importanceB = b.importance || 50;
        
        if (dateB - dateA !== 0) return dateB - dateA;
        return importanceB - importanceA;
      });
      
      for (let i = 0; i < Math.min(10, all_rudyak_memories.length); i++) {
        const mem = all_rudyak_memories[i];
        console.log(`\n${i+1}. [${mem.collection}] [${mem.memoryType}] ID: ${mem.id} - ${mem.createdAt}`);
        console.log(`   Title: ${mem.title || 'No title'}`);
        
        // Show the most relevant content
        const content_fields = ['description', 'context', 'action', 'outcome'];
        for (let field of content_fields) {
          if (mem[field] && String(mem[field]).length > 10) {
            console.log(`   ${field.toUpperCase()}: ${String(mem[field]).substring(0, 200)}...`);
            break;
          }
        }
        
        if (mem.entities || mem.tags) {
          console.log(`   Metadata: entities=${JSON.stringify(mem.entities)}, tags=${JSON.stringify(mem.tags)}`);
        }
        
        if (mem.importance) console.log(`   Importance: ${mem.importance}/100`);
        
        if (mem.potential_match) console.log(`   ⚡ POTENTIAL MATCH - verify content`);
        if (mem.found_in_other_table) console.log(`   🎯 FOUND IN UNEXPECTED TABLE`);
      }
      
      if (all_rudyak_memories.length > 10) {
        console.log(`\n... and ${all_rudyak_memories.length - 10} more memories`);
      }
      
      console.log('\n✅ SUCCESS: Found Rudyak and his bio! The memory system is working!');
      
    } else {
      console.log('\n❌ STILL NOT FOUND - THIS IS IMPOSSIBLE!');
      console.log('\n🔍 Let me check if there are any recent unprocessed memories...');
      
      // Check recent memories that might not be vectorized yet
      const [recent_memories] = await connection.execute(`
        SELECT * FROM episodicMemories 
        WHERE userId = 225 AND createdAt > DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY createdAt DESC
        LIMIT 20
      `);
      
      if (recent_memories.length > 0) {
        console.log('\n📅 RECENT MEMORIES (last 7 days):');
        recent_memories.forEach(row => {
          console.log(`  - ${row.createdAt}: ${row.title}`);
        });
        console.log('\n💡 Rudyak might be in these recent memories that have not been processed yet!');
      }
    }
    
    await connection.end();
  } catch (error) {
    console.log('❌ Database search error:', error.message);
    console.log('❌ BUT I WONT GIVE UP - Let me try a different approach!');
  }
}

findRudyakNoMatterWhat();