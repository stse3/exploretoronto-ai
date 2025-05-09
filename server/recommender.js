const events = require('./mockData');


const vibes = ["chill", "relaxing", "calm", "exciting", "lively"];
const categories = ["outdoors", "art", "literature", "museum"];

function getRecommendations(userInput) {
    const input = userInput.toLowerCase();
  
    const matchedVibe = vibes.find(v => input.includes(v));
    const matchedCategory = categories.find(c => input.includes(c));
  
    const recommendations = events.filter(event => {
      const vibeMatch = matchedVibe ? event.vibe === matchedVibe : true;
      const categoryMatch = matchedCategory ? event.category === matchedCategory : true;
      return vibeMatch && categoryMatch;
    });
  
    return recommendations.slice(0, 3); // Return top 3 matches
  }

  module.exports = {getRecommendations};