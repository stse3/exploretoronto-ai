// scraper/classify_events.js
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Configure Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// NLP service URL
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8000/classify';

const classifyEvents = async () => {
    console.log('Starting event classification...');
    
    try {
        // Get unprocessed events (limit batch size to avoid timeouts)
        const { data: events, error } = await supabase
            .from('events')
            .select('id, title, description')
            .eq('processed', false)
            .limit(50);
        
        if (error) throw error;
        
        console.log(`Found ${events.length} unprocessed events to classify`);
        
        // Skip if no events to process
        if (events.length === 0) {
            console.log('No events to classify. Exiting.');
            return;
        }
        
        // Track stats
        let classified = 0;
        let errors = 0;
        
        // Process each event
        for (const event of events) {
            try {
                // Combine title and description for better classification
                const text = `${event.title} ${event.description}`;
                
                console.log(`Classifying event: ${event.title.substring(0, 30)}...`);
                
                // Call NLP service
                const response = await axios.post(NLP_SERVICE_URL, {
                    text,
                    threshold: 0.15 // Adjust threshold as needed
                });
                
                if (response.status === 200) {
                    const categories = response.data.categories;
                    
                    // Filter out "accessible" false positives
                    const filteredCategories = categories.filter(cat => 
                        cat.label !== "accessible" || text.toLowerCase().includes("accessible")
                    );
                    
                    console.log(`Event ${event.id} has ${filteredCategories.length} categories`);
                    
                    // Store each category in the junction table
                    for (const category of filteredCategories) {
                        const { error: insertError } = await supabase
                            .from('event_categories')
                            .insert({
                                event_id: event.id,
                                category: category.label,
                                score: category.score
                            })
                            .onConflict(['event_id', 'category'])
                            .merge(); // Update score if category already exists
                        
                        if (insertError) {
                            console.error(`Error inserting category: ${insertError.message}`);
                        }
                    }
                    
                    // Extract top category names for direct storage
                    const topCategories = filteredCategories
                        .slice(0, 5) // Store top 5 categories
                        .map(cat => cat.label);
                    
                    // Mark event as processed and store top categories directly
                    const { error: updateError } = await supabase
                        .from('events')
                        .update({ 
                            processed: true,
                            categories: topCategories
                        })
                        .eq('id', event.id);
                    
                    if (updateError) throw updateError;
                    
                    classified++;
                } else {
                    throw new Error(`NLP service returned status ${response.status}`);
                }
            } catch (error) {
                console.error(`Error classifying event ${event.id}:`, error.message);
                errors++;
            }
        }
        
        console.log(`Classification complete: ${classified} events classified, ${errors} errors`);
        
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