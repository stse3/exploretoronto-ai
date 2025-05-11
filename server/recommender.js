// recommender.js
require('dotenv').config();
const axios = require('axios');

// NLP service URL
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8000/classify';

// Define event categories - you can customize these based on your needs
const EVENT_CATEGORIES = [
  "art", "music", "food", "outdoor", "festival", "family", "comedy", 
  "theater", "film", "sports", "education", "tech", "workshop", 
  "cultural", "chill", "indoors", "active", "nightlife", "free"
];

// Mood-to-category mappings
const MOOD_MAPPINGS = {
  "chill": ["art", "film", "indoors", "cultural", "education"],
  "active": ["sports", "outdoor", "festival"],
  "fun": ["comedy", "music", "festival", "nightlife"],
  "educational": ["education", "workshop", "tech", "cultural"],
  "family-friendly": ["family", "outdoor", "festival", "free"],
  "indoors": ["theater", "film", "art", "comedy", "tech", "workshop"],
  "outdoor": ["outdoor", "festival", "sports"],
  "creative": ["art", "workshop", "cultural"],
  "social": ["festival", "nightlife", "food", "music"]
};

/**
 * Classifies user input to extract relevant categories and scores
 * 
 * @param {string} userInput - Natural language input from the user
 * @returns {Promise<Object>} - Object with labels (categories) and scores
 */
async function classifyUserInput(userInput) {
  try {
    // First, check for direct category mentions
    const directMatches = findDirectCategoryMatches(userInput);
    
    if (directMatches.labels.length > 0) {
      console.log("Found direct category matches:", directMatches);
      return directMatches;
    }
    
    // If no direct matches, use the NLP service
    console.log("No direct matches, sending to NLP service:", userInput);
    
    const response = await axios.post(NLP_SERVICE_URL, {
      text: userInput,
      threshold: 0.65 // Lower threshold for more matches
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000 // 10-second timeout
    });
    
    if (response.status === 200 && response.data && response.data.categories) {
      // Format the response to match our expected structure
      const result = {
        labels: [],
        scores: []
      };
      
      // Process each category from the NLP service
      response.data.categories.forEach(category => {
        result.labels.push(category.label);
        result.scores.push(category.score);
        
        // If we have mood mappings, expand them to related categories
        if (MOOD_MAPPINGS[category.label]) {
          MOOD_MAPPINGS[category.label].forEach(relatedCategory => {
            // Only add if not already included
            if (!result.labels.includes(relatedCategory)) {
              result.labels.push(relatedCategory);
              result.scores.push(category.score * 0.8); // Slightly lower score for related categories
            }
          });
        }
      });
      
      console.log("NLP classification result:", result);
      return result;
    }
    
    // If NLP service fails or returns empty, use fallback method
    return fallbackClassification(userInput);
    
  } catch (error) {
    console.error("Error calling NLP service:", error.message);
    
    // Use fallback classification if NLP service fails
    return fallbackClassification(userInput);
  }
}

/**
 * Simple keyword matching as a fallback method
 */
function findDirectCategoryMatches(userInput) {
  const result = {
    labels: [],
    scores: []
  };
  
  const inputLower = userInput.toLowerCase();
  
  // Check for direct mentions of categories
  EVENT_CATEGORIES.forEach(category => {
    if (inputLower.includes(category.toLowerCase())) {
      result.labels.push(category);
      result.scores.push(0.95); // High confidence for direct mentions
    }
  });
  
  // Check for mood keywords
  Object.keys(MOOD_MAPPINGS).forEach(mood => {
    if (inputLower.includes(mood.toLowerCase())) {
      // Add the mood itself
      if (!result.labels.includes(mood)) {
        result.labels.push(mood);
        result.scores.push(0.9);
      }
      
      // Add related categories with slightly lower scores
      MOOD_MAPPINGS[mood].forEach(relatedCategory => {
        if (!result.labels.includes(relatedCategory)) {
          result.labels.push(relatedCategory);
          result.scores.push(0.8);
        }
      });
    }
  });
  
  return result;
}

/**
 * Fallback classification when NLP service fails
 */
function fallbackClassification(userInput) {
  const inputLower = userInput.toLowerCase();
  const result = {
    labels: [],
    scores: []
  };
  
  // Simple keyword mapping
  const keywordMap = {
    "fun": ["festival", "comedy", "nightlife"],
    "relax": ["chill", "indoors", "art"],
    "learn": ["education", "workshop", "tech"],
    "outdoor": ["outdoor", "sports", "festival"],
    "indoor": ["indoors", "theater", "film"],
    "chill": ["chill", "indoors", "art"],
    "exciting": ["festival", "nightlife", "music"],
    "family": ["family", "free", "outdoor"],
    "date": ["food", "film", "cultural"],
    "weekend": ["festival", "outdoor", "nightlife"],
    "cheap": ["free", "outdoor", "cultural"],
    "night": ["nightlife", "comedy", "music"],
    "day": ["outdoor", "food", "cultural"]
  };
  
  // Check for keywords
  Object.keys(keywordMap).forEach(keyword => {
    if (inputLower.includes(keyword)) {
      keywordMap[keyword].forEach(category => {
        if (!result.labels.includes(category)) {
          result.labels.push(category);
          result.scores.push(0.7);
        }
      });
    }
  });
  
  // If still no matches, extract nouns as potential interests
  if (result.labels.length === 0) {
    const words = inputLower
      .split(/\W+/)
      .filter(word => word.length > 3 && !['want', 'something', 'looking', 'interested'].includes(word));
    
    words.forEach(word => {
      // Add the word itself if it's not a common verb or preposition
      result.labels.push(word);
      result.scores.push(0.6);
    });
  }
  
  return result;
}

/**
 * Scores an event based on how well it matches the extracted categories
 * 
 * @param {Object} event - The event object from the database
 * @param {Array} categories - Array of category labels
 * @param {Array} scores - Array of confidence scores corresponding to categories
 * @returns {number} - A relevance score
 */
function getEventScore(event, categories, scores) {
  if (!categories || categories.length === 0) return 0;
  
  let relevanceScore = 0;
  const eventText = `${event.title || ''} ${event.description || ''} ${event.location || ''}`.toLowerCase();
  
  // Score based on category matches
  categories.forEach((category, index) => {
    const categoryScore = scores[index] || 0.5;
    
    // Check if category appears in event text
    if (eventText.includes(category.toLowerCase())) {
      // Boost score by category confidence score
      relevanceScore += categoryScore * 2;
    }
    
    // If event has categories array, check for direct category match
    if (event.categories && Array.isArray(event.categories)) {
      if (event.categories.includes(category)) {
        relevanceScore += categoryScore * 3; // Higher boost for direct category matches
      }
    }
  });
  
  // Normalize score
  relevanceScore = Math.min(10, relevanceScore);
  
  // Boost for upcoming events (events happening sooner get slight boost)
  const eventDate = new Date(event.date);
  const now = new Date();
  const daysDifference = Math.max(0, Math.floor((eventDate - now) / (1000 * 60 * 60 * 24)));
  
  // Slight boost for events happening within next 7 days
  if (daysDifference <= 7) {
    relevanceScore *= 1.1;
  }
  
  return relevanceScore;
}

module.exports = {
  classifyUserInput,
  getEventScore,
  EVENT_CATEGORIES
};