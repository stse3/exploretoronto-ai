// scraper/classify_events.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const os = require('os');

// Configure Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// NLP service URL
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8000/classify';
const NLP_BATCH_URL = process.env.NLP_SERVICE_URL 
  ? `${process.env.NLP_SERVICE_URL.replace(/\/classify$/, "")}/batch` 
  : 'http://localhost:8000/batch';

// Configuration
const CPU_COUNT = os.cpus().length;
// Much smaller batch size since NLP service is timing out
const BATCH_SIZE = 5;            // Process just 5 events at a time
const API_BATCH_SIZE = 1;        // Send just 1 event to NLP service at a time
const MAX_RETRIES = 3;           // Maximum number of retries for API calls
const RETRY_DELAY = 1000;        // Initial retry delay in ms (doubles after each retry)
const MAX_CONCURRENT_BATCHES = 1; // Don't run concurrent batches to avoid overloading NLP
const API_TIMEOUT = 30000;       // Reduce timeout to 30 seconds

console.log(`System has ${CPU_COUNT} CPUs. Using batch size: ${BATCH_SIZE}, concurrent batches: ${MAX_CONCURRENT_BATCHES}`);

/**
 * Helper function to retry failed API calls with exponential backoff
 */
const callWithRetry = async (fn, retries = MAX_RETRIES, delay = RETRY_DELAY) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    console.log(`Retrying after error: ${error.message}. Retries left: ${retries}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return callWithRetry(fn, retries - 1, delay * 2);
  }
};

/**
 * Split array into chunks of specified size
 */
const chunkArray = (array, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

/**
 * Sequential NLP classification - process one event at a time to avoid timeouts
 */
const batchClassifyEvents = async (events) => {
  console.log(`Classifying ${events.length} events sequentially to avoid timeouts...`);
  
  // Process events one at a time
  const results = [];
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const text = `${event.title || ''} ${event.description || ''}`.trim();
    
    console.log(`[${i+1}/${events.length}] Processing event ${event.id} (text length: ${text.length} chars)`);
    const startTime = Date.now();
    
    try {
      // First try the single event API
      const response = await callWithRetry(() => 
        axios.post(NLP_SERVICE_URL, {
          text,
          threshold: 0.90
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: API_TIMEOUT
        })
      );
      
      if (response.status === 200 && response.data && response.data.categories) {
        const processingTime = (Date.now() - startTime) / 1000;
        console.log(`Event ${event.id} classified in ${processingTime.toFixed(2)}s with ${response.data.categories.length} categories`);
        
        results.push({
          id: event.id,
          categories: response.data.categories
        });
      } else {
        console.error(`Invalid response format for event ${event.id}`);
        results.push({ id: event.id, categories: [] });
      }
    } catch (error) {
      console.error(`Error classifying event ${event.id}: ${error.message}`);
      
      // Add empty result to keep processing moving
      results.push({ id: event.id, categories: [] });
      
      // Small delay to let system recover if it's overwhelmed
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
};

/**
 * Processes a batch of events and updates the database
 */
const processBatch = async (eventsBatch) => {
  try {
    const batchStartTime = Date.now();
    const batchSize = eventsBatch.length;
    
    // Get classifications for all events in batch
    const batchResults = await batchClassifyEvents(eventsBatch);
    
    // Prepare bulk operations
    const categoryInserts = [];
    const eventUpdates = [];
    
    // Process each result
    for (let i = 0; i < eventsBatch.length; i++) {
      const event = eventsBatch[i];
      const result = batchResults.find(r => r.id === event.id);
      
      if (!result || !result.categories || result.categories.length === 0) {
        console.warn(`No valid classification result found for event ${event.id}`);
        
        // Still mark as processed to avoid reprocessing in the future
        eventUpdates.push({
          id: event.id,
          processed: true,
          categories: []
        });
        
        continue;
      }
      
      // Filter out "accessible" false positives
      const filteredCategories = result.categories.filter(cat => 
        cat.label !== "accessible" || 
        `${event.title} ${event.description}`.toLowerCase().includes("accessible")
      );
      
      // Add categories to junction table batch
      filteredCategories.forEach(category => {
        categoryInserts.push({
          event_id: event.id,
          category: category.label,
          score: category.score
        });
      });
      
      // Extract top categories for direct storage
      const topCategories = filteredCategories
        .slice(0, 5) // Store top 5 categories
        .map(cat => cat.label);
      
      // Add to event update batch
      eventUpdates.push({
        id: event.id,
        processed: true,
        categories: topCategories
      });
    }
    
    // Bulk insert categories in chunks to avoid payload limits
    const categoryChunks = chunkArray(categoryInserts, 100);
    for (const chunk of categoryChunks) {
      if (chunk.length > 0) {
        const { error: insertError } = await supabase
          .from('event_categories')
          .upsert(chunk, {
            onConflict: ['event_id', 'category']
          });
        
        if (insertError) {
          console.error('Error bulk inserting categories:', insertError.message);
        }
      }
    }
    
    // Bulk update events in chunks
    const eventChunks = chunkArray(eventUpdates, 50);
    for (const chunk of eventChunks) {
      if (chunk.length > 0) {
        // Prepare updates with proper format for .in() clause
        const ids = chunk.map(event => event.id);
        const updateObjects = {};
        
        chunk.forEach(event => {
          // Store each event by id for easy lookup
          updateObjects[event.id] = {
            processed: event.processed,
            categories: event.categories
          };
        });
        
        // Perform bulk update with .in()
        const { error } = await supabase
          .from('events')
          .update({ processed: true })
          .in('id', ids);
        
        if (error) {
          console.error(`Error batch updating events:`, error.message);
          
          // Fall back to individual updates
          console.warn('Falling back to individual event updates');
          
          const updatePromises = chunk.map(async (eventUpdate) => {
            const { id, ...updateData } = eventUpdate;
            const { error } = await supabase
              .from('events')
              .update(updateData)
              .eq('id', id);
            
            if (error) {
              console.error(`Error updating event ${id}:`, error.message);
              return false;
            }
            return true;
          });
          
          await Promise.all(updatePromises);
        }
        
        // Now update the categories separately for each event
        for (const event of chunk) {
          const { error } = await supabase
            .from('events')
            .update({ categories: event.categories })
            .eq('id', event.id);
          
          if (error) {
            console.error(`Error updating categories for event ${event.id}:`, error.message);
          }
        }
      }
    }
    
    const batchTime = (Date.now() - batchStartTime) / 1000;
    console.log(`Batch processed in ${batchTime.toFixed(2)}s - Avg: ${(batchTime/batchSize).toFixed(2)}s per event`);
    
    return eventUpdates.length;
  } catch (error) {
    console.error('Error processing batch:', error.message);
    return 0;
  }
};

/**
 * Format seconds into a human-readable time string (HH:MM:SS)
 */
const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  
  return parts.join(' ');
};

/**
 * Process events sequentially to avoid overwhelming the NLP service
 */
const processEventsSequentially = async (events) => {
  const totalEvents = events.length;
  let processed = 0;
  const startTime = Date.now();
  
  console.log(`Processing ${totalEvents} events sequentially (batch size: ${BATCH_SIZE})`);
  
  // Process events in small batches
  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batchStartTime = Date.now();
    
    // Create a single batch
    const endIdx = Math.min(i + BATCH_SIZE, events.length);
    const batch = events.slice(i, endIdx);
    
    console.log(`\n--- Starting batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(events.length/BATCH_SIZE)} ---`);
    console.log(`Processing events ${i+1}-${endIdx} of ${totalEvents}`);
    
    // Process this batch
    const batchProcessed = await processBatch(batch);
    processed += batchProcessed;
    
    // Log detailed progress
    const processedSoFar = Math.min(i + BATCH_SIZE, totalEvents);
    const percentComplete = Math.round((processedSoFar / totalEvents) * 100);
    const batchTime = (Date.now() - batchStartTime) / 1000;
    const elapsedTime = (Date.now() - startTime) / 1000;
    
    // Only calculate estimated time if we have processed some events
    let estimatedRemaining = "calculating...";
    if (processedSoFar > 0) {
      const avgTimePerEvent = elapsedTime / processedSoFar;
      const remaining = avgTimePerEvent * (totalEvents - processedSoFar);
      estimatedRemaining = `${remaining.toFixed(1)}s (${formatTime(remaining)})`;
    }
    
    console.log(`Batch completed in ${batchTime.toFixed(1)}s (${(batchTime/batch.length).toFixed(1)}s per event)`);
    console.log(`Progress: ${processedSoFar}/${totalEvents} (${percentComplete}%)`);
    console.log(`Total time elapsed: ${elapsedTime.toFixed(1)}s (${formatTime(elapsedTime)})`);
    console.log(`Estimated time remaining: ${estimatedRemaining}`);
    
    // Add a small delay between batches to let system recover
    if (i + BATCH_SIZE < events.length) {
      console.log("Waiting 2 seconds before next batch...");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return processed;
};

/**
 * Main classification function
 */
const classifyEvents = async () => {
  console.log('Starting optimized event classification...');
  console.log(`Using server configuration: Batch size: ${BATCH_SIZE}, API batch size: ${API_BATCH_SIZE}, Concurrent batches: ${MAX_CONCURRENT_BATCHES}`);
  
  try {
    // Get total count first (for better progress reporting)
    const { count, error: countError } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('processed', false);
      
    if (countError) throw countError;
    
    console.log(`Found ${count} unprocessed events to classify in total`);
    
    if (count === 0) {
      console.log('No events to classify. Exiting.');
      return;
    }
    
    // Process in chunks of 100 to avoid memory issues
    const CHUNK_SIZE = 100;
    let offset = 0;
    let totalClassified = 0;
    const totalStartTime = Date.now();
    
    // Process in chunks until all events are processed
    while (true) {
      // Get next chunk of unprocessed events
      const { data: events, error } = await supabase
        .from('events')
        .select('id, title, description')
        .eq('processed', false)
        .range(offset, offset + CHUNK_SIZE - 1)
        .order('id');
      
      if (error) throw error;
      
      if (events.length === 0) {
        console.log('No more events to process. Done.');
        break;
      }
      
      console.log(`Processing chunk of ${events.length} events (offset: ${offset})`);
      
      // Process this chunk of events sequentially
      const classified = await processEventsSequentially(events);
      totalClassified += classified;
      
      // Update offset for next chunk
      offset += CHUNK_SIZE;
      
      // Log progress
      const percentComplete = Math.min(100, Math.round((offset / count) * 100));
      console.log(`Overall progress: ~${percentComplete}% - ${totalClassified}/${count} events classified so far`);
    }
    
    const totalDuration = (Date.now() - totalStartTime) / 1000;
    const avgTime = totalClassified > 0 ? totalDuration / totalClassified : 0;
    
    console.log('=========== Classification Summary ===========');
    console.log(`Total events classified: ${totalClassified}`);
    console.log(`Total time: ${totalDuration.toFixed(2)} seconds`);
    console.log(`Average time per event: ${avgTime.toFixed(2)} seconds`);
    console.log('=============================================');
    
  } catch (error) {
    console.error('Error during classification process:', error);
  }
};

// Run classification
classifyEvents()
  .catch(console.error)
  .finally(() => {
    console.log('Classification execution finished');
    process.exit(0);
  });