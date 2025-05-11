// Home page
import {useState} from 'react';
import NoiseGradientBackground from '../components/NoiseGradientBackground';
import EventCard from '../components/EventCard';
import { motion } from 'framer-motion';

export default function Home() {
    const [message, setMessage] = useState('');
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
  
    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (!message.trim()) return;
      
      setLoading(true);
      setError('');
      
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
        const response = await fetch(`${backendUrl}/recommend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: message }),
        });
        
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        setRecommendations(data.recommendations || []);
        
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError('Failed to get recommendations. Please try again.');
      } finally {
        setLoading(false);
      }
    };
  
    return (
      <NoiseGradientBackground 
        fromColor="#4338ca" 
        toColor="#7e22ce"
        className="min-h-screen"
      >
        <div className="container mx-auto px-4 py-12 ">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              WanderTO AI
            </h1>
            <p className="text-xl text-white/80">
              Keeping Toronto Connected
            </p>
          </motion.div>
          
          <motion.form 
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="max-w-xl mx-auto mb-16"
          >
            <div className="relative">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What are you feeling?"
                className="w-full px-6 py-4 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 text-lg"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={loading}
                type="submit"
                className="absolute right-2 top-2 bottom-2 bg-white/20 hover:bg-white/30 text-white px-6 rounded-full font-medium transition-colors disabled:opacity-70"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Finding...
                  </span>
                ) : 'Discover'}
              </motion.button>
            </div>
            
            {error && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-red-400/20 text-white p-4 rounded-lg mt-4 backdrop-blur-sm"
              >
                {error}
              </motion.div>
            )}
          </motion.form>
          
          {recommendations.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl font-bold text-white text-center mb-8">
                Recommended Events for You
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((rec, i) => (
                  <EventCard key={i} event={rec} index={i} />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </NoiseGradientBackground>
    );
  }