// scraper/scraper.js
require('dotenv').config();
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

// Simple sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Configure Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const extractBlogTOEvents = async () => {
    console.log('Starting BlogTO event scraper...');
    // Start the timer at the beginning of the scraping process
    const startTime = new Date();
    
    const url = 'https://www.blogto.com/events/';
    
    // Initialize stats variables at the function scope
    let inserted = 0;
    let updated = 0;
    let errors = 0;
    
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        console.log('Navigating to BlogTO events page...');
        await page.goto(url, { waitUntil: 'networkidle2' });
        console.log('Page loaded successfully.');
        
        // Wait for dynamic content to load
        console.log('Waiting for dynamic content to load...');
        await sleep(2000);
        
        // Default date info in case date picker fails
        let selectedDateInfo = null;
        
        // Look for the date picker
        console.log('Looking for date picker...');
        const hasDatePicker = await page.evaluate(() => {
            return !!document.querySelector('.pika-button');
        });
        
        if (hasDatePicker) {
            console.log('Found date picker. Finding today or upcoming date...');
            
            // Try to find and click on today's date or an upcoming date
            selectedDateInfo = await page.evaluate(() => {
                // Get today's date information
                const today = new Date();
                const currentYear = today.getFullYear();
                const currentMonth = today.getMonth(); // 0-based (0 = January)
                const currentDay = today.getDate();
                
                // Try to find today's button first
                let dateButton = document.querySelector(`.pika-button[data-pika-year="${currentYear}"][data-pika-month="${currentMonth}"][data-pika-day="${currentDay}"]`);
                
                // If not found, look for the closest upcoming date
                if (!dateButton) {
                    // Get all date buttons
                    const dateButtons = Array.from(document.querySelectorAll('.pika-button'));
                    
                    for (const button of dateButtons) {
                        const year = parseInt(button.getAttribute('data-pika-year'));
                        const month = parseInt(button.getAttribute('data-pika-month'));
                        const day = parseInt(button.getAttribute('data-pika-day'));
                        
                        const buttonDate = new Date(year, month, day);
                        
                        // If the date is today or in the future
                        if (buttonDate >= today) {
                            dateButton = button;
                            break;
                        }
                    }
                }
                
                // Click the button if found
                if (dateButton) {
                    dateButton.click();
                    
                    // Get the date information
                    const year = dateButton.getAttribute('data-pika-year');
                    const month = parseInt(dateButton.getAttribute('data-pika-month')) + 1; // Convert to 1-based
                    const day = dateButton.getAttribute('data-pika-day');
                    
                    return {
                        success: true,
                        message: `Selected date: ${month}/${day}/${year}`,
                        date: `${month}/${day}/${year}`
                    };
                }
                
                return {
                    success: false,
                    message: 'Could not find today or an upcoming date button'
                };
            });
            
            console.log(selectedDateInfo?.message || 'Date selection failed');
            
            if (selectedDateInfo && selectedDateInfo.success) {
                // Wait for the page to update with filtered events
                console.log('Waiting for page to update with filtered events...');
                await sleep(3000);
            }
        } else {
            console.log('No date picker found. Proceeding with default view.');
        }
        
        // Extract all events data using the exact class names provided
        console.log('Extracting event data using specified class names...');
        const events = await page.evaluate((dateInfo) => {
            const eventElements = document.querySelectorAll('.event-info-box-grid-item');
            const selectedDate = dateInfo && dateInfo.success ? dateInfo.date : null;
            
            return Array.from(eventElements).map(eventElement => {
                // Extract title and link using event-info-box-title-link
                const titleLinkElement = eventElement.querySelector('.event-info-box-title-link');
                const title = titleLinkElement ? titleLinkElement.textContent.trim() : 'No title found';
                const link = titleLinkElement ? titleLinkElement.href : null;
                
                // Extract image using event-info-box-picture
                const imageContainer = eventElement.querySelector('.event-info-box-picture');
                const imageElement = imageContainer ? imageContainer.querySelector('img') : null;
                const image = imageElement ? imageElement.src : null;
                
                // Extract location using event-info-box-venue
                // Handle both text and link scenarios
                const venueElement = eventElement.querySelector('.event-info-box-venue');
                let location = null;
                let venueLink = null;
                
                if (venueElement) {
                    // Check for venue text element
                    const venueTextElement = venueElement.querySelector('.event-info-box-venue-text');
                    if (venueTextElement) {
                        location = venueTextElement.textContent.trim();
                    } else {
                        // If no specific text element, use the venue element's text
                        location = venueElement.textContent.trim();
                    }
                    
                    // Check for venue link
                    const venueLinkElement = venueElement.querySelector('a');
                    if (venueLinkElement) {
                        venueLink = venueLinkElement.href;
                        // If no location text was found, use the link text
                        if (!location || location === '') {
                            location = venueLinkElement.textContent.trim();
                        }
                    }
                }
                
                // Extract event time from event-info-box-date and split into start_time and end_time
                const timeElement = eventElement.querySelector('.event-info-box-date');
                let start_time = null;
                let end_time = null;
                
                if (timeElement) {
                    const timeText = timeElement.textContent.trim();
                    // Parse times like "11:30 PM – 12:45 AM"
                    const timeParts = timeText.split('–').map(part => part.trim());
                    if (timeParts.length >= 1) {
                        start_time = timeParts[0];
                        // If there's an end time
                        if (timeParts.length >= 2) {
                            end_time = timeParts[1];
                        }
                    }
                }
                
                // Extract description using event-info-box-description
                const descriptionElement = eventElement.querySelector('.event-info-box-description');
                const description = descriptionElement ? 
                                  descriptionElement.textContent.trim() : 
                                  'No description found';
                
                return {
                    title,
                    link,
                    image,
                    date: selectedDate,
                    start_time,  // Using start_time instead of time
                    end_time,    // Adding end_time
                    location,
                    venue_link: venueLink,
                    description
                };
            });
        }, selectedDateInfo);
        
        console.log(`Found ${events.length} events after filtering`);
        
        // Add metadata before saving
        const eventsWithMetadata = events.map(event => ({
            ...event,
            source: 'blogto',
            scraped_at: new Date().toISOString()
        }));
        
        // Save to Supabase
        console.log('Saving events to Supabase...');
        
        // Track stats for reporting
        // Note: These variables are now declared at the function scope
        
        // Process each event
        for (const event of eventsWithMetadata) {
            // Skip events without links (they're our unique identifier)
            if (!event.link) {
                console.log('Skipping event with no link');
                continue;
            }
            
            try {
                // Check if event already exists
                const { data: existingEvents } = await supabase
                    .from('events')
                    .select('id')
                    .eq('link', event.link)
                    .limit(1);
                
                if (existingEvents && existingEvents.length > 0) {
                    // Update existing event
                    const { error } = await supabase
                        .from('events')
                        .update(event)
                        .eq('link', event.link);
                    
                    if (error) throw error;
                    updated++;
                } else {
                    // Insert new event
                    const { error } = await supabase
                        .from('events')
                        .insert(event);
                    
                    if (error) throw error;
                    inserted++;
                }
            } catch (error) {
                console.error(`Error saving event "${event.title}":`, error.message);
                errors++;
            }
        }
        
        console.log(`Database updated: ${inserted} new events, ${updated} updated, ${errors} errors`);
        
    } catch (error) {
        console.error('Error during extraction:', error);
    } finally {
        await browser.close();
        
        // Calculate and log the total execution time
        const endTime = new Date();
        const executionTimeMs = endTime - startTime;
        const executionTimeSec = (executionTimeMs / 1000).toFixed(2);
        const executionTimeMin = (executionTimeMs / 60000).toFixed(2);
        
        console.log(`Browser closed. Extraction complete.`);
        console.log(`Total execution time: ${executionTimeSec} seconds (${executionTimeMin} minutes)`);
        
        // Return the execution time for any calling function that needs it
        return {
            executionTimeMs,
            executionTimeSec,
            executionTimeMin,
            stats: {
                inserted,
                updated,
                errors
            }
        };
    }
};

// Run the scraper
extractBlogTOEvents()
    .then(result => {
        if (result) {
            console.log(`Scraper completed successfully! Processed ${result.stats.inserted + result.stats.updated} events in ${result.executionTimeSec} seconds.`);
        }
    })
    .catch(console.error)
    .finally(() => {
        console.log('Scraper execution finished');
        // Exit explicitly to ensure GitHub Actions doesn't hang
        process.exit(0);
    });