// scraper/scraper.js
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
    
    const url = 'https://www.blogto.com/events/';
    
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
                
                // Extract description using event-info-box-description
                const descriptionElement = eventElement.querySelector('.event-info-box-description');
                const description = descriptionElement ? 
                                  descriptionElement.textContent.trim() : 
                                  'No description found';
                
                // In your scraper.js, update this part:
                    return {
                        title,
                        link,
                        image,
                        date: selectedDate,
                        location,
                        venue_link: venueLink, // Change from venueLink to venue_link
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
        let inserted = 0;
        let updated = 0;
        let errors = 0;
        
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
        console.log('Browser closed. Extraction complete.');
    }
};

// Run the scraper
extractBlogTOEvents()
    .catch(console.error)
    .finally(() => {
        console.log('Scraper execution finished');
        // Exit explicitly to ensure GitHub Actions doesn't hang
        process.exit(0);
    });