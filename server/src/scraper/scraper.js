// scraper/scraper.js
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

// Simple sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Configure Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Date formatting helper
const formatDate = (date) => {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
};

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
        // Track all unique events across dates
        const uniqueEvents = new Map();
        
        // Configure how many days to scrape
        const daysToScrape = 7; // Scrape a week of events
        
        for (let dayOffset = 0; dayOffset < daysToScrape; dayOffset++) {
            // Calculate the date to scrape
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + dayOffset);
            const formattedDate = formatDate(targetDate);
            
            console.log(`\nScraping events for ${formattedDate}...`);
            
            // Navigate to events page (or refresh for subsequent days)
            if (dayOffset === 0) {
                console.log('Navigating to BlogTO events page...');
                await page.goto(url, { waitUntil: 'networkidle2' });
            } else {
                console.log('Refreshing events page for new date...');
                await page.goto(url, { waitUntil: 'networkidle2' });
            }
            
            console.log('Page loaded successfully.');
            
            // Wait for dynamic content to load
            await sleep(2000);
            
            // Select the target date
            console.log('Selecting date in calendar...');
            const selectedDateInfo = await page.evaluate((targetDateObj) => {
                // Convert JS Date to date picker format
                const year = targetDateObj.getFullYear();
                const month = targetDateObj.getMonth(); // 0-based
                const day = targetDateObj.getDate();
                
                // Find the date button in the picker
                const dateButton = document.querySelector(
                    `.pika-button[data-pika-year="${year}"][data-pika-month="${month}"][data-pika-day="${day}"]`
                );
                
                // Click the button if found
                if (dateButton) {
                    dateButton.click();
                    
                    return {
                        success: true,
                        message: `Selected date: ${month + 1}/${day}/${year}`,
                        date: `${month + 1}/${day}/${year}`
                    };
                }
                
                return {
                    success: false,
                    message: 'Could not find the target date button'
                };
            }, targetDate);
            
            console.log(selectedDateInfo?.message || 'Date selection failed');
            
            if (selectedDateInfo && selectedDateInfo.success) {
                // Wait for the page to update with filtered events
                console.log('Waiting for page to update with filtered events...');
                await sleep(3000);
                
                // Extract events for this date
                console.log('Extracting event data...');
                const events = await page.evaluate((dateInfo) => {
                    const eventElements = document.querySelectorAll('.event-info-box-grid-item');
                    const selectedDate = dateInfo.date;
                    
                    return Array.from(eventElements).map(eventElement => {
                        // Extract title and link
                        const titleLinkElement = eventElement.querySelector('.event-info-box-title-link');
                        const title = titleLinkElement ? titleLinkElement.textContent.trim() : 'No title found';
                        const link = titleLinkElement ? titleLinkElement.href : null;
                        
                        // Extract image
                        const imageContainer = eventElement.querySelector('.event-info-box-picture');
                        const imageElement = imageContainer ? imageContainer.querySelector('img') : null;
                        const image = imageElement ? imageElement.src : null;
                        
                        // Extract location/venue
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
                        
                        // Extract description
                        const descriptionElement = eventElement.querySelector('.event-info-box-description');
                        const description = descriptionElement ? 
                                          descriptionElement.textContent.trim() : 
                                          'No description found';
                        
                        // Extract time if available (BlogTO sometimes includes this)
                        const timeElement = eventElement.querySelector('.event-info-box-time');
                        const timeText = timeElement ? timeElement.textContent.trim() : null;
                        
                        // Attempt to parse start/end times
                        let startTime = null;
                        let endTime = null;
                        
                        if (timeText) {
                            // Try to extract times using regex (format might vary)
                            const timeMatch = timeText.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*-\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
                            if (timeMatch) {
                                startTime = timeMatch[1];
                                endTime = timeMatch[2];
                            } else {
                                // If we couldn't parse a range, just store the whole time string
                                startTime = timeText;
                            }
                        }
                        
                        // Extract price if available
                        const priceElement = eventElement.querySelector('.event-info-box-price');
                        const price = priceElement ? priceElement.textContent.trim() : null;
                        
                        return {
                            title,
                            link,
                            image,
                            date: selectedDate,
                            location,
                            venue_link: venueLink,
                            description,
                            start_time: startTime,
                            end_time: endTime,
                            price
                        };
                    });
                }, selectedDateInfo);
                
                console.log(`Found ${events.length} events for ${selectedDateInfo.date}`);
                
                // Process events and merge multi-day events
                for (const event of events) {
                    if (!event.link) {
                        console.log('Skipping event with no link');
                        continue;
                    }
                    
                    if (uniqueEvents.has(event.link)) {
                        // This is a multi-day event - update its dates
                        const existingEvent = uniqueEvents.get(event.link);
                        
                        // Initialize date_list if needed
                        if (!existingEvent.date_list) {
                            existingEvent.date_list = [existingEvent.date];
                        }
                        
                        // Add this date if not already present
                        if (!existingEvent.date_list.includes(event.date)) {
                            existingEvent.date_list.push(event.date);
                        }
                        
                        // Sort dates and update date range
                        const sortedDates = [...existingEvent.date_list].sort((a, b) => {
                            return new Date(a) - new Date(b);
                        });
                        
                        existingEvent.date_list = sortedDates;
                        existingEvent.date_range = sortedDates.length > 1 
                            ? `${sortedDates[0]} - ${sortedDates[sortedDates.length - 1]}`
                            : sortedDates[0];
                    } else {
                        // First time seeing this event
                        uniqueEvents.set(event.link, {
                            ...event,
                            date_list: [event.date],
                            date_range: event.date // Single date initially
                        });
                    }
                }
            } else {
                console.log(`Skipping date ${formattedDate} due to selection failure`);
            }
        }
        
        console.log(`\nProcessed ${uniqueEvents.size} unique events across ${daysToScrape} days`);
        
        // Convert Map to array and add metadata
        const eventsToSave = Array.from(uniqueEvents.values()).map(event => ({
            ...event,
            source: 'blogto',
            scraped_at: new Date().toISOString(),
            processed: false,
            categories: null // Initialize empty categories array
        }));
        
        // Save to Supabase
        console.log('\nSaving events to Supabase...');
        
        // Track stats for reporting
        let inserted = 0;
        let updated = 0;
        let errors = 0;
        
        // Process each event
        for (const event of eventsToSave) {
            try {
                // Check if event already exists
                const { data: existingEvents, error: queryError } = await supabase
                    .from('events')
                    .select('id, date, date_list, date_range')
                    .eq('link', event.link)
                    .limit(1);
                
                if (queryError) throw queryError;
                
                if (existingEvents && existingEvents.length > 0) {
                    const existingEvent = existingEvents[0];
                    
                    // Merge date information
                    let combinedDateList = event.date_list || [event.date];
                    
                    if (existingEvent.date_list && existingEvent.date_list.length > 0) {
                        // Combine and deduplicate dates
                        combinedDateList = [...new Set([
                            ...existingEvent.date_list,
                            ...combinedDateList
                        ])];
                    }
                    
                    // Sort dates
                    combinedDateList.sort((a, b) => new Date(a) - new Date(b));
                    
                    // Update event with merged date information
                    const updateData = {
                        ...event,
                        date_list: combinedDateList,
                        date_range: combinedDateList.length > 1 
                            ? `${combinedDateList[0]} - ${combinedDateList[combinedDateList.length - 1]}`
                            : combinedDateList[0],
                        processed: false // Reset processed flag since we're updating
                    };
                    
                    // Update existing event
                    const { error: updateError } = await supabase
                        .from('events')
                        .update(updateData)
                        .eq('id', existingEvent.id);
                    
                    if (updateError) throw updateError;
                    updated++;
                } else {
                    // Insert new event
                    const { error: insertError } = await supabase
                        .from('events')
                        .insert(event);
                    
                    if (insertError) throw insertError;
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