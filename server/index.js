// In index.js
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const { classifyUserInput, EVENT_CATEGORIES } = require('./recommender');
// Import the getEventScore function
const { getEventScore } = require('./recommender'); // Make sure to export this from recommender.js

const app = express();

// Supabase client setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Middleware
// In index.js - Modified CORS configuration



// After (updated code):
app.use(cors({
  // Allow requests from both the frontend and testing environments
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, or Postman)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      process.env.VITE_FRONTEND_URL || 'http://localhost:5173', // Frontend
      'http://localhost:5001',                                   // Same origin
      'http://localhost:8000'                                    // NLP service
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Origin'],
  credentials: true  // Allow credentials
}));

app.use(express.json());

// Modified recommend endpoint to use getEventScore
app.post('/recommend', async (req, res) => {
  const userInput = req.body.message;
  const likedEventIds = req.body.likedEvents || []; // Optional: Get liked events from frontend

  if (!userInput) {
    return res.status(400).json({ error: 'No user input provided' });
  }

  try {
    // Get categories and scores from user input using the classifier
    const classification = await classifyUserInput(userInput);
    console.log("Classification result:", classification);

    // Get the categories and scores
    const categories = classification.labels;
    const scores = classification.scores;
    
    // If no categories found with sufficient confidence, use simple keyword matching
    if (categories.length === 0) {
      console.log("No categories with sufficient confidence, using direct input");
      
      // Simple search using the user's input directly
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .or(`title.ilike.%${userInput}%,description.ilike.%${userInput}%`)
        .order('date', { ascending: true })
        .limit(10);

      if (error) throw new Error(error.message);
      
      if (data.length === 0) {
        return res.json({ 
          recommendations: [],
          message: "No events found matching your request. Try a different search."
        });
      }
      
      return res.json({ recommendations: data });
    }

    // Build a query that searches for events matching the categories
    let queryString = '';
    
    // Create OR conditions for each category across relevant fields
    categories.forEach((category, index) => {
      if (index > 0) queryString += ',';
      queryString += `title.ilike.%${category}%,description.ilike.%${category}%,location.ilike.%${category}%`;
    });

    // Execute the search to get initial results
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .or(queryString)
      .gte('date', new Date().toISOString()) // Only show upcoming events
      .order('date', { ascending: true })
      .limit(30); // Get more events than we need so we can rank them

    if (error) throw new Error(error.message);

    // If no initial results, try a fallback search
    if (data.length === 0) {
      const fallbackResponse = await supabase
        .from('events')
        .select('*')
        .gte('date', new Date().toISOString())
        .order('date', { ascending: true })
        .limit(10);
        
      if (fallbackResponse.error) throw new Error(fallbackResponse.error.message);
      
      return res.json({ 
        recommendations: fallbackResponse.data,
        message: "We couldn't find exact matches, but here are some upcoming events you might enjoy."
      });
    }

    // Score each event using getEventScore
    const scoredEvents = data.map(event => ({
      ...event,
      relevanceScore: getEventScore(event, categories, scores)
    }));

    // Apply any additional boosting based on liked events (if implemented)
    if (likedEventIds.length > 0) {
      // Get the liked events
      const { data: likedEvents } = await supabase
        .from('events')
        .select('*')
        .in('id', likedEventIds);
      
      if (likedEvents && likedEvents.length > 0) {
        // Extract keywords from liked events (simple example)
        const likedKeywords = new Set();
        likedEvents.forEach(event => {
          const words = (event.title + ' ' + (event.description || '')).toLowerCase()
            .split(/\W+/)
            .filter(word => word.length > 3);
          words.forEach(word => likedKeywords.add(word));
        });
        
        // Boost events that match liked keywords
        scoredEvents.forEach(event => {
          for (const keyword of likedKeywords) {
            if ((event.title || '').toLowerCase().includes(keyword) || 
                (event.description || '').toLowerCase().includes(keyword)) {
              event.relevanceScore *= 1.1; // 10% boost per keyword match
            }
          }
        });
      }
    }

    // Sort by relevance score (highest first)
    scoredEvents.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Take the top 5
    const topEvents = scoredEvents.slice(0, 5);

    // Return the filtered and ranked events
    res.json({ 
      recommendations: topEvents,
      matchedCategories: categories,
      message: `Here are events matching your mood: ${categories.join(', ')}`
    });
    
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ 
      error: "Something went wrong with the recommendation system",
      details: error.message 
    });
  }
});

// Other endpoints remain the same...

// Start the server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});