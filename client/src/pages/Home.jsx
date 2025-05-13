// Home.jsx
import { useState } from 'react';
import EventCard from '../components/EventCard';
import { motion, AnimatePresence } from 'framer-motion';
import { PartyPopper } from 'lucide-react';

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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        when: "beforeChildren",
        staggerChildren: 0.1
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring", stiffness: 100 }
    }
  };

  const pageTransition = {
    type: "spring",
    stiffness: 100,
    damping: 20
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={pageTransition}
      className="flex flex-col min-h-screen bg-white border border-black m-10 rounded-3xl relative overflow-hidden"
    >
      {/* Animated Decorative Circles */}
      <motion.div 
        className="absolute -left-36 -bottom-36 w-96 h-96 rounded-full bg-[#FEE7E7]"
        animate={{
          y: [0, -15, 0],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div 
        className="absolute right-0 top-0 w-96 h-96 rounded-full bg-[#EDFCFF]"
        animate={{
          x: [0, 10, 0],
          y: [0, -10, 0],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      <motion.div 
        className="absolute right-40 bottom-40 w-40 h-40 rounded-full bg-[#FFF7EB]"
        animate={{
          x: [0, -30, 0],
          y: [0, 30, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* HEADER */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="py-4 px-6 rounded-t-3xl relative z-10"
      >
        <div className="container mx-auto flex justify-between items-center">
          <motion.h1 
            className="text-lg font-bold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            WanderTO AI
          </motion.h1>
          <nav>
            <motion.ul 
              className="flex space-x-8"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {['home', 'about', 'search', 'profile'].map((item) => (
                <motion.li key={item} variants={itemVariants}>
                  <motion.a 
                    href={`#${item}`} 
                    className="hover:underline hover:bg-gradient-to-r hover:from-blue-200 hover:to-rose-300 hover:text-white px-2 py-1 rounded transition-all"
                    whileHover={{ y: -2 }}
                    whileTap={{ y: 0 }}
                  >
                    {item}
                  </motion.a>
                </motion.li>
              ))}
            </motion.ul>
          </nav>
        </div>
      </motion.header>
      
      {/* Main Content */}
      <main className="flex-grow text-black flex justify-center items-center relative z-10 px-8">
        <div className="container mx-auto px-4 py-12">
          <motion.div 
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <motion.h1 
              className="text-5xl font-bold mb-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, duration: 0.6, type: "spring" }}
            >
              WanderTO AI
            </motion.h1>
            <motion.p 
              className="text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
            >
              Keeping Toronto Connected - Find community, events and local hidden gems
            </motion.p>
          </motion.div>
          
          <motion.form 
            onSubmit={handleSubmit}
            className="max-w-xl mx-auto mb-16"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.6 }}
          >
            <div className="relative">
              <motion.div 
                className="flex items-center w-full px-4 py-2 bg-white rounded-full border border-gray-300"
                whileHover={{ boxShadow: "0 0 8px rgba(0, 0, 0, 0.1)", scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <svg className="w-5 h-5 text-gray-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="what mood are you feeling today?"
                  className="w-full outline-none text-black placeholder-gray-500"
                />
                <motion.button
                  disabled={loading}
                  type="submit"
                  className="ml-2 bg-white text-gray-700 px-6 py-1 rounded-full text-sm transition-all hover:bg-gradient-to-r hover:from-blue-200 hover:to-rose-300 hover:text-white duration-300 disabled:opacity-70 border border-gray-300"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {loading ? (
                    <motion.span 
                      className="flex items-center"
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      Finding...
                    </motion.span>
                  ) : "discover"}
                </motion.button>
              </motion.div>
            </div>
          </motion.form>
          
          <AnimatePresence mode="wait">
            {recommendations.length > 0 && (
              <motion.div
                key="recommendations"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.5 }}
              >
                <motion.h2 
                  className="text-xl font-semibold mb-4 ml-8 flex items-center"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <PartyPopper className="mr-2" />
                  Recommended events for you
                </motion.h2>
                
                <motion.div 
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-4 py-6 rounded-3xl bg-amber-100 bg-opacity-10 border border-gray-200"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {recommendations.map((rec, i) => (
                    <EventCard key={i} event={rec} index={i} />
                  ))}
                </motion.div>
              </motion.div>
            )}
            
            {recommendations.length === 0 && !loading && !error && (
              <motion.div
                key="empty-state"
                className="text-center mt-24 text-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.8 }}
              >
                <motion.p 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="mb-2"
                >
                  There are over 200+ events in Toronto everyday,
                </motion.p>
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  let's stay connected in today's digital age.
                </motion.p>
              </motion.div>
            )}
            
            {error && (
              <motion.div
                key="error"
                className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg mx-auto max-w-xl"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </motion.div>
  );
}